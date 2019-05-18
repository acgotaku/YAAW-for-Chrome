import Vue from 'vue/dist/vue.esm.js'

Vue.config.productionTip = false

const vm = new Vue({
  data () {
    return {
      isContextMenus: true,
      isAutoRename: true,
      isInterception: false,
      isSync: false,
      fileSize: 0,
      downloadPath: '',
      rpcLists: [{
        name: 'ARIA2 RPC',
        path: 'http://localhost:6800/jsonrpc'
      }],
      whitelist: '',
      blocklist: '',
      saved: false,
      version: chrome.runtime.getManifest().version,
      title: chrome.i18n.getMessage('title'),
      contextMenu: chrome.i18n.getMessage('contextMenu'),
      contextMenuDesc: chrome.i18n.getMessage('contextMenuDesc'),
      autoRename: chrome.i18n.getMessage('autoRename'),
      autoRenameDesc: chrome.i18n.getMessage('autoRenameDesc'),
      syncConfig: chrome.i18n.getMessage('syncConfig'),
      syncConfigDesc: chrome.i18n.getMessage('syncConfigDesc'),
      interception: chrome.i18n.getMessage('interception'),
      interceptionDesc: chrome.i18n.getMessage('interceptionDesc'),
      fileSizeStr: chrome.i18n.getMessage('fileSizeStr'),
      unit: chrome.i18n.getMessage('unit'),
      downloadPathStr: chrome.i18n.getMessage('downloadPathStr'),
      downloadPathDesc: chrome.i18n.getMessage('downloadPathDesc'),
      addRPC: chrome.i18n.getMessage('addRPC'),
      removeRPC: chrome.i18n.getMessage('removeRPC'),
      whitelistStr: chrome.i18n.getMessage('whitelistStr'),
      blocklistStr: chrome.i18n.getMessage('blocklistStr'),
      save: chrome.i18n.getMessage('save'),
      saveSuccess: chrome.i18n.getMessage('saveSuccess'),
      reset: chrome.i18n.getMessage('reset')
    }
  },
  mounted () {
    chrome.storage.sync.get(null, (items) => {
      for (let key in items) {
        this[key] = items[key]
        chrome.storage.local.set({ key: items[key] }, () => {
          console.log('chrome first local set: %s, %s', key, items[key])
        })
      }
    })
    chrome.storage.local.get(null, (items) => {
      for (let key in items) {
        this[key] = items[key]
      }
    })
  },
  methods: {
    addRPCForm () {
      this.rpcLists.push({
        name: '',
        path: ''
      })
    },
    removeRPCByIndex (index) {
      this.rpcLists.splice(index, 1)
    },
    saveConfig () {
      const configData = {
        isContextMenus: this.isContextMenus,
        isAutoRename: this.isAutoRename,
        isInterception: this.isInterception,
        isSync: this.isSync,
        fileSize: this.fileSize,
        downloadPath: this.downloadPath,
        rpcLists: this.rpcLists,
        whitelist: this.whitelist,
        blocklist: this.blocklist
      }
      for (let key in configData) {
        chrome.storage.local.set({ [key]: configData[key] }, () => {
          console.log('chrome local set: %s, %s', key, configData[key])
        })
        if (configData['isSync'] === true) {
          chrome.storage.sync.set({ [key]: configData[key] }, () => {
            console.log('chrome sync set: %s, %s', key, configData[key])
          })
        }
      }
      this.showSavedInfo()
    },
    clear () {
      const confirmMessage = chrome.i18n.getMessage('resetConfirm')
      if (window.confirm(confirmMessage)) {
        chrome.storage.sync.clear()
        chrome.storage.local.clear()
        location.reload()
      }
    },
    showSavedInfo () {
      this.saved = true
      setTimeout(() => {
        this.saved = false
      }, 3000)
    }
  }
})

vm.$mount('#app')
