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
    chrome.storage.local.get(key, resolve)
  })
}
// 生成右键菜单
function addContextMenu (id, title) {
  chrome.contextMenus.create({
    id: id,
    title: title,
    contexts: ['link']
  })
}

function updateContextMenu () {
  chrome.contextMenus.removeAll(() => {
    getConfig('isContextMenus').then(({ isContextMenus }) => {
      if (isContextMenus !== false) {
        getConfig('rpcLists').then(({ rpcLists }) => {
          if (!rpcLists) {
            rpcLists = [{
              name: 'ARIA2 RPC',
              path: defaultRPC
            }]
          }
          rpcLists.forEach(rpcItem => {
            addContextMenu(rpcItem.path, rpcItem.name)
          })
        })
      }
    })
  })
}
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (changes.rpcLists) {
    updateContextMenu()
  }
})

// 弹出chrome通知
function showNotification (id, opt) {
  chrome.notifications.create(id, opt, function (notifyId) {
    return notifyId
  })
  setTimeout(function () {
    chrome.notifications.clear(id, function () {})
  }, 3000)
}

function requestAuth (url) {
  return url.match(/^(?:(?![^:@]+:[^:@/]*@)[^:/?#.]+:)?(?:\/\/)?(?:([^:@]*(?::[^:@]*)?)?@)?/)[1]
}

function removeAuth (url) {
  return url.replace(/^((?![^:@]+:[^:@/]*@)[^:/?#.]+:)?(\/\/)?(?:(?:[^:@]*(?::[^:@]*)?)?@)?(.*)/, '$1$2$3')
}

// 解析 RPC地址 返回验证数据 和地址
function parseURL (url) {
  const parseURL = new URL(removeAuth(url))
  let authStr = requestAuth(url)
  if (authStr) {
    if (!authStr.includes('token:')) {
      authStr = `Basic ${btoa(authStr)}`
    }
  }
  const paramsString = parseURL.hash.substr(1)
  const options = {}
  const searchParams = new URLSearchParams(paramsString)
  for (const key of searchParams) {
    options[key[0]] = key.length === 2 ? key[1] : 'enabled'
  }
  const path = parseURL.origin + parseURL.pathname
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
          header: header
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
        console.log(error)
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

function matchRule (str, rule) {
  return new RegExp('^' + rule.split('*').join('.*') + '$').test(str)
}

function getHostName (url) {
  if (url.startsWith('http')) {
    return decodeURI(new URL(url).hostname)
  } else {
    return url
  }
}

async function isCapture (downloadItem) {
  const { fileSize } = await getConfig('fileSize')
  const { whitelist } = await getConfig('whitelist')
  const { blocklist } = await getConfig('blocklist')
  const url = downloadItem.referrer || downloadItem.url

  if (downloadItem.error || downloadItem.state !== 'in_progress' || url.startsWith('http') === false) {
    return false
  }

  const target = getHostName(url)

  const inWhitelist = whitelist.split('\n').some((site) => {
    const rule = getHostName(site)
    return matchRule(target, rule)
  })

  if (inWhitelist) {
    return true
  }

  const inBlocklist = blocklist.split('\n').some((site) => {
    const rule = getHostName(site)
    return matchRule(target, rule)
  })

  if (inBlocklist) {
    return false
  }

  if (downloadItem.fileSize >= fileSize * 1024 * 1024) {
    return true
  } else {
    return false
  }
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  aria2Send(info.menuItemId, {
    link: info.linkUrl
  })
})

function interceptionDownload (downloadItem) {
  getConfig('isInterception').then(({ isInterception }) => {
    if (isInterception) {
      isCapture(downloadItem).then(result => {
        if (result) {
          chrome.downloads.getFileIcon(downloadItem.id, function (iconUrl) {
            if (chrome.runtime.lastError) {
              console.log(chrome.runtime.lastError.message)
            }
            getConfig('rpcLists').then(({ rpcLists }) => {
              if (!rpcLists) {
                rpcLists = [{
                  name: 'ARIA2 RPC',
                  path: defaultRPC
                }]
              }
              aria2Send(rpcLists[0].path, {
                link: downloadItem.finalUrl,
                filename: decodeURIComponent(downloadItem.filename).split(/[/\\]/).pop(),
                icon: iconUrl || 'images/icon.jpg'
              })
              chrome.downloads.cancel(downloadItem.id, function () {})
              chrome.downloads.erase({ id: downloadItem.id })
            })
          })
        }
      })
    }
  })
}

getConfig('isAutoRename').then(({ isAutoRename }) => {
  if (isAutoRename !== false) {
    chrome.downloads.onDeterminingFilename.addListener(interceptionDownload)
  } else {
    chrome.downloads.onCreated.addListener(interceptionDownload)
  }
})

function openYAAW () {
  const index = chrome.extension.getURL('yaaw/index.html')
  chrome.tabs.getAllInWindow(undefined, function (tabs) {
    tabs.forEach(tab => {
      if (tab.url && tab.url === index) {
        chrome.tabs.update(tab.id, { selected: true })
      }
    })
    chrome.tabs.create({ url: index })
  })
}
chrome.browserAction.onClicked.addListener(function () {
  openYAAW()
})

chrome.notifications.onClicked.addListener(function () {
  openYAAW()
})
// 软件版本更新提示
const manifest = chrome.runtime.getManifest()
const previousVersion = localStorage.getItem('version')
if (previousVersion === '' || previousVersion !== manifest.version) {
  const opt = {
    type: 'basic',
    title: chrome.i18n.getMessage('updated'),
    message: chrome.i18n.getMessage('updatedDesc', manifest.version),
    iconUrl: 'images/icon.jpg'
  }
  const id = new Date().getTime().toString()
  showNotification(id, opt)
  localStorage.setItem('version', manifest.version)
}

if (!localStorage.getItem('jsonrpc_path')) {
  localStorage.setItem('jsonrpc_path', defaultRPC)
}

updateContextMenu()
