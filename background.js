const defaultRPC = 'http://localhost:6800/jsonrpc'

const httpSend = ({ url, options }, resolve, reject) => {
  fetch(url, options).then((response) => {
    if (response.ok) {
      response.json().then((data) => {
        resolve(data)
      })
    } else {
      reject(response)
    }
  }).catch((err) => {
    reject(err)
  })
}

const getConfig = (key) => {
  return new Promise(function (resolve) {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.error(`Failed to read config key "${key}":`, chrome.runtime.lastError)
        resolve({})
      } else {
        resolve(result)
      }
    })
  })
}

function addContextMenu (id, title) {
  chrome.contextMenus.create({
    id,
    title,
    contexts: ['link']
  })
}

// Queue updates so overlapping calls cannot create duplicate menu ids
let contextMenuUpdate = Promise.resolve()

function updateContextMenu () {
  contextMenuUpdate = contextMenuUpdate.then(async () => {
    await chrome.contextMenus.removeAll()
    const { isContextMenus } = await getConfig('isContextMenus')
    if (isContextMenus !== false) {
      let { rpcLists } = await getConfig('rpcLists')
      if (!rpcLists) {
        rpcLists = [{
          name: 'ARIA2 RPC',
          path: defaultRPC
        }]
      }
      rpcLists.forEach(rpcItem => {
        addContextMenu(rpcItem.path, rpcItem.name)
      })
    }
  })
}

const syncKeys = ['isContextMenus', 'isInterception', 'isSync', 'fileSize', 'downloadPath', 'rpcLists', 'whitelist', 'blocklist']

// Local storage is the only place config is read from; synced config is copied
// into it when this device has sync on, or has never been configured (new device)
async function pullSyncConfig () {
  const syncItems = await chrome.storage.sync.get(syncKeys)
  const { isSync } = await getConfig('isSync')
  if (isSync === true || (isSync === undefined && syncItems.isSync === true)) {
    chrome.storage.local.set(syncItems)
  }
}

chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName === 'sync') {
    pullSyncConfig()
  } else if (areaName === 'local' && (changes.rpcLists || changes.isContextMenus)) {
    updateContextMenu()
  }
})

chrome.runtime.onStartup.addListener(pullSyncConfig)

function showNotification (id, opt) {
  chrome.notifications.create(id, opt)
}

function requestAuth (url) {
  return url.match(/^(?:(?![^:@]+:[^:@/]*@)[^:/?#.]+:)?(?:\/\/)?(?:([^:@]*(?::[^:@]*)?)?@)?/)[1]
}

function removeAuth (url) {
  return url.replace(/^((?![^:@]+:[^:@/]*@)[^:/?#.]+:)?(\/\/)?(?:(?:[^:@]*(?::[^:@]*)?)?@)?(.*)/, '$1$2$3')
}

function parseURL (url) {
  const parsedURL = new URL(removeAuth(url))
  let authStr = requestAuth(url)
  if (authStr) {
    if (!authStr.includes('token:')) {
      authStr = `Basic ${btoa(Array.from(new TextEncoder().encode(authStr), b => String.fromCharCode(b)).join(''))}`
    }
  }
  const paramsString = parsedURL.hash.substring(1)
  const options = {}
  const searchParams = new URLSearchParams(paramsString)
  for (const key of searchParams) {
    options[key[0]] = key.length === 2 ? key[1] : 'enabled'
  }
  const path = parsedURL.origin + parsedURL.pathname
  return { authStr, path, options }
}

function generateParameter (authStr, path, data) {
  if (authStr && authStr.startsWith('token')) {
    data.params.unshift(authStr)
  }
  const parameter = {
    url: path,
    options: {
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: JSON.stringify(data)
    }
  }
  if (authStr && authStr.startsWith('Basic')) {
    parameter.options.headers.Authorization = authStr
  }
  return parameter
}

function aria2Send (rpcPath, fileDownloadInfo) {
  const { authStr, path, options } = parseURL(rpcPath)
  chrome.cookies.getAll({ url: fileDownloadInfo.link }, function (cookies) {
    const formatedCookies = []
    cookies.forEach(cookie => {
      formatedCookies.push(cookie.name + '=' + cookie.value)
    })
    const header = []
    header.push('Cookie: ' + formatedCookies.join('; '))
    header.push('User-Agent: ' + navigator.userAgent)

    const rpcData = {
      jsonrpc: '2.0',
      method: 'aria2.addUri',
      id: new Date().getTime(),
      params: [
        [fileDownloadInfo.link], {
          header
        }
      ]
    }
    const rpcOption = rpcData.params[1]
    if (fileDownloadInfo.fileName) {
      rpcOption.out = fileDownloadInfo.fileName
    }
    if (options) {
      for (const key in options) {
        rpcOption[key] = options[key]
      }
    }
    getConfig('downloadPath').then(({ downloadPath }) => {
      if (downloadPath) {
        rpcOption.dir = downloadPath
      }

      const parameter = generateParameter(authStr, path, rpcData)

      httpSend(parameter, () => {
        const opt = {
          type: 'basic',
          title: chrome.i18n.getMessage('startDownload'),
          message: fileDownloadInfo.fileName ? fileDownloadInfo.fileName : chrome.i18n.getMessage('downloadSuccess'),
          iconUrl: fileDownloadInfo.icon ? fileDownloadInfo.icon : 'images/icon.jpg'
        }
        const id = new Date().getTime().toString()
        showNotification(id, opt)
      }, (error) => {
        console.error('aria2 RPC error:', error)
        const opt = {
          type: 'basic',
          title: chrome.i18n.getMessage('downloadFailed'),
          message: chrome.i18n.getMessage('downloadFailedDesc'),
          iconUrl: 'images/icon.jpg'
        }
        const id = new Date().getTime().toString()
        showNotification(id, opt)
      })
    })
  })
}

// Only * is a wildcard; everything else in the rule matches literally
function matchRule (str, rule) {
  const pattern = rule.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp('^' + pattern + '$').test(str)
}

function getHostName (url) {
  if (url.startsWith('http')) {
    try {
      return decodeURI(new URL(url).hostname)
    } catch (e) {
      return url
    }
  } else {
    return url
  }
}

function matchList (target, list) {
  return list.split('\n').some((site) => {
    site = site.trim().toLowerCase()
    return site !== '' && matchRule(target, getHostName(site))
  })
}

async function isCapture (downloadItem) {
  const { fileSize = 0 } = await getConfig('fileSize')
  const { whitelist = '' } = await getConfig('whitelist')
  const { blocklist = '' } = await getConfig('blocklist')
  const url = downloadItem.referrer || downloadItem.url
  const link = downloadItem.finalUrl || downloadItem.url

  // blob:/data: downloads come from http pages but aria2 cannot fetch them
  if (downloadItem.error || downloadItem.state !== 'in_progress' || !/^https?:/.test(url) || !/^https?:/.test(link)) {
    return false
  }

  const target = getHostName(url)

  if (matchList(target, whitelist)) {
    return true
  }

  if (matchList(target, blocklist)) {
    return false
  }

  // fileSize is -1 and totalBytes 0 when the server sends no Content-Length
  const size = Math.max(downloadItem.fileSize, downloadItem.totalBytes)
  return fileSize <= 0 || size <= 0 || size >= fileSize * 1024 * 1024
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  aria2Send(info.menuItemId, {
    link: info.linkUrl
  })
})

async function interceptionDownload (downloadItem) {
  const { isInterception } = await getConfig('isInterception')
  if (!isInterception || !(await isCapture(downloadItem))) {
    return
  }
  chrome.downloads.cancel(downloadItem.id, function () {
    chrome.downloads.erase({ id: downloadItem.id })
  })
  let { rpcLists } = await getConfig('rpcLists')
  if (!rpcLists) {
    rpcLists = [{
      name: 'ARIA2 RPC',
      path: defaultRPC
    }]
  }
  // filename is usually still empty at onCreated; aria2 then names the file itself
  aria2Send(rpcLists[0].path, {
    link: downloadItem.finalUrl,
    fileName: downloadItem.filename.split(/[/\\]/).pop()
  })
}

// Use onCreated rather than onDeterminingFilename: the latter blocks every download
// (and the Save As dialog) until this service worker wakes up and replies,
// even when interception is disabled.
chrome.downloads.onCreated.addListener(interceptionDownload)

function openYAAW () {
  const index = chrome.runtime.getURL('yaaw/index.html')
  chrome.tabs.query({}, function (tabs) {
    let found = false
    tabs.forEach(tab => {
      if (tab.url && tab.url === index) {
        chrome.tabs.update(tab.id, { active: true })
        found = true
      }
    })
    if (!found) {
      chrome.tabs.create({ url: index })
    }
  })
}

chrome.action.onClicked.addListener(function () {
  openYAAW()
})

chrome.notifications.onClicked.addListener(function () {
  openYAAW()
})

chrome.runtime.onInstalled.addListener(async ({ previousVersion }) => {
  const manifest = chrome.runtime.getManifest()
  if (previousVersion !== manifest.version) {
    const opt = {
      type: 'basic',
      title: chrome.i18n.getMessage('updated'),
      message: chrome.i18n.getMessage('updatedDesc', manifest.version),
      iconUrl: 'images/icon.jpg'
    }
    const id = new Date().getTime().toString()
    showNotification(id, opt)
  }

  const { jsonrpc_path: jsonrpcPath } = await getConfig('jsonrpc_path')
  if (!jsonrpcPath) {
    chrome.storage.local.set({ jsonrpc_path: defaultRPC })
  }

  await pullSyncConfig()
  updateContextMenu()
})
