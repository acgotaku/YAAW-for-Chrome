const defaultRPC = {
  name: 'ARIA2 RPC',
  path: 'http://localhost:6800/jsonrpc'
}

const state = {
  isContextMenus: true,
  isInterception: false,
  isSync: false,
  fileSize: 0,
  downloadPath: '',
  rpcLists: [{ ...defaultRPC }],
  whitelist: '',
  blocklist: ''
}

function i18n (key) {
  return chrome.i18n.getMessage(key)
}

function $ (id) {
  return document.getElementById(id)
}

function renderRPCList () {
  const container = $('rpc-list')
  container.innerHTML = ''
  state.rpcLists.forEach((rpc, index) => {
    const div = document.createElement('div')
    div.className = 'control-group'
    div.innerHTML = `
      <div class="control-group-inner">
        <input type="text" class="input-small" placeholder="RPC Name" value="${escapeHtml(rpc.name)}" data-index="${index}" data-field="name">
      </div>
      <div class="controls">
        <input type="text" class="input-xlarge" placeholder="RPC Path" value="${escapeHtml(rpc.path)}" data-index="${index}" data-field="path">
        ${index === 0
          ? `<button class="btn btn-rpc" id="btn-add-rpc">${i18n('addRPC')}</button>`
          : `<button class="btn btn-rpc btn-danger" data-remove="${index}">${i18n('removeRPC')}</button>`
        }
        ${index === 0 ? `<span class="help-block">${escapeHtml(i18n('rpcPathDesc'))}</span>` : ''}
      </div>
    `
    container.appendChild(div)
  })

  container.querySelector('#btn-add-rpc')?.addEventListener('click', () => {
    state.rpcLists.push({ name: '', path: '' })
    renderRPCList()
  })

  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.remove)
      state.rpcLists.splice(idx, 1)
      renderRPCList()
    })
  })

  container.querySelectorAll('input[data-index]').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.index)
      const field = input.dataset.field
      state.rpcLists[idx][field] = input.value
    })
  })
}

function escapeHtml (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fillI18n () {
  $('title').textContent = i18n('title')
  $('version').textContent = 'v' + chrome.runtime.getManifest().version
  $('label-contextMenus').textContent = i18n('contextMenu')
  $('contextMenuDesc').textContent = i18n('contextMenuDesc')
  $('label-syncConfig').textContent = i18n('syncConfig')
  $('syncConfigDesc').textContent = i18n('syncConfigDesc')
  $('label-interception').textContent = i18n('interception')
  $('interceptionDesc').textContent = i18n('interceptionDesc')
  $('fileSizeStr').textContent = i18n('fileSizeStr')
  $('unit').textContent = i18n('unit')
  $('label-downloadPath').textContent = i18n('downloadPathStr')
  $('downloadPathDesc').textContent = i18n('downloadPathDesc')
  $('label-whitelist').textContent = i18n('whitelistStr')
  $('label-blocklist').textContent = i18n('blocklistStr')
  $('btn-save').textContent = i18n('save')
  $('btn-reset').textContent = i18n('reset')
}

function fillForm () {
  $('contextMenus').checked = state.isContextMenus
  $('syncConfig').checked = state.isSync
  $('interception').checked = state.isInterception
  $('fileSize').value = state.fileSize
  $('downloadPath').value = state.downloadPath
  $('whitelist').value = state.whitelist
  $('blocklist').value = state.blocklist
  renderRPCList()
}

function bindFormEvents () {
  $('contextMenus').addEventListener('change', e => { state.isContextMenus = e.target.checked })
  $('syncConfig').addEventListener('change', e => {
    state.isSync = e.target.checked
    if (state.isSync) {
      loadSyncConfig()
    }
  })
  $('interception').addEventListener('change', e => { state.isInterception = e.target.checked })
  $('fileSize').addEventListener('input', e => { state.fileSize = Number(e.target.value) })
  $('downloadPath').addEventListener('input', e => { state.downloadPath = e.target.value })
  $('whitelist').addEventListener('input', e => { state.whitelist = e.target.value })
  $('blocklist').addEventListener('input', e => { state.blocklist = e.target.value })

  $('btn-save').addEventListener('click', saveConfig)
  $('btn-reset').addEventListener('click', clearConfig)
}

function saveConfig () {
  const configData = {
    isContextMenus: state.isContextMenus,
    isInterception: state.isInterception,
    isSync: state.isSync,
    fileSize: state.fileSize,
    downloadPath: state.downloadPath,
    rpcLists: state.rpcLists,
    whitelist: state.whitelist,
    blocklist: state.blocklist
  }
  chrome.storage.local.set(configData, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to save config:', chrome.runtime.lastError)
      return
    }
    if (!configData.isSync) {
      showMessage('saveSuccess')
      return
    }
    chrome.storage.sync.set(configData, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to sync config:', chrome.runtime.lastError)
        showMessage('syncFailed', true)
      } else {
        showMessage('saveSuccess')
      }
    })
  })
}

function clearConfig () {
  if (window.confirm(i18n('resetConfirm'))) {
    chrome.storage.sync.clear()
    chrome.storage.local.clear()
    location.reload()
  }
}

let messageTimer = null

function showMessage (key, isError = false) {
  const el = $('config-saved')
  el.textContent = i18n(key)
  el.classList.toggle('error', isError)
  el.classList.add('show')
  clearTimeout(messageTimer)
  messageTimer = setTimeout(() => el.classList.remove('show'), isError ? 8000 : 3000)
}

// The background keeps local storage up to date with synced config
function loadConfig () {
  chrome.storage.local.get(Object.keys(state), (localItems) => {
    Object.assign(state, localItems)
    fillForm()
  })
}

// When sync is turned on, show what is already in the cloud so saving
// does not silently overwrite another device's config
function loadSyncConfig () {
  chrome.storage.sync.get(Object.keys(state), (syncItems) => {
    if (chrome.runtime.lastError || Object.keys(syncItems).length === 0) {
      return
    }
    Object.assign(state, syncItems, { isSync: true })
    fillForm()
    showMessage('syncLoaded')
  })
}

fillI18n()
bindFormEvents()
loadConfig()
