var HttpSendRead = function(info) {
    Promise.prototype.done=Promise.prototype.then;
    Promise.prototype.fail=Promise.prototype.catch;
    return new Promise(function(resolve, reject) {
        var http = new XMLHttpRequest();
        var contentType = "\u0061\u0070\u0070\u006c\u0069\u0063\u0061\u0074\u0069\u006f\u006e\u002f\u0078\u002d\u0077\u0077\u0077\u002d\u0066\u006f\u0072\u006d\u002d\u0075\u0072\u006c\u0065\u006e\u0063\u006f\u0064\u0065\u0064\u003b\u0020\u0063\u0068\u0061\u0072\u0073\u0065\u0074\u003d\u0055\u0054\u0046\u002d\u0038";
        var timeout = 3000;
        if (info.contentType != null) {
            contentType = info.contentType;
        }
        if (info.timeout != null) {
            timeout = info.timeout;
        }
        var timeId = setTimeout(httpclose, timeout);
        function httpclose() {
            http.abort();
        }
        http.onreadystatechange = function() {
            if (http.readyState == 4) {
                if ((http.status == 200 && http.status < 300) || http.status == 304) {
                    clearTimeout(timeId);
                    if (info.dataType == "json") {
                        resolve(JSON.parse(http.responseText), http.status, http);
                    }
                    else if (info.dataType == "SCRIPT") {
                        // eval(http.responseText);
                        resolve(http.responseText, http.status, http);
                    }
                }
                else {
                    clearTimeout(timeId);
                    reject(http, http.statusText, http.status);
                }
            }
        }
        http.open(info.type, info.url, true);
        http.setRequestHeader("Content-type", contentType);
        for (h in info.headers) {
            if (info.headers[h]) {
                http.setRequestHeader(h, info.headers[h]);
            }
        }
        if (info.type == "POST") {
            http.send(info.data);
        }
        else {
            http.send();
        }                          
    });
};

//生成右键菜单
function addContextMenu(id,title){
    chrome.contextMenus.create({
    id:id,
    title: title,
    contexts: ['link']
    });
}
//弹出chrome通知
function showNotification(opt){
    var notification = chrome.notifications.create(status.toString(),opt,function(notifyId){return notifyId});
    setTimeout(function(){
        chrome.notifications.clear(status.toString(),function(){});
    },5000);
}
//解析RPC地址
function parse_url(url){
    var auth_str = request_auth(url);
    var auth = null;
    if (auth_str) {
        if(auth_str.indexOf('token:') == 0){
            auth= auth_str;
        }else{
        auth = "Basic " + btoa(auth_str);
        }    
    }
    var url_path=remove_auth(url);
    function request_auth(url) {
        return url.match(/^(?:(?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?(?:\/\/)?(?:([^:@]*(?::[^:@]*)?)?@)?/)[1];
    }
    function remove_auth(url) {
        return url.replace(/^((?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?(\/\/)?(?:(?:[^:@]*(?::[^:@]*)?)?@)?(.*)/, '$1$2$3');
    }
    return [url_path,auth];
}

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    var rpc_data = {
        "jsonrpc": "2.0",
        "method": "aria2.addUri",
        "id": new Date().getTime(),
        "params": [[info.linkUrl],{}
        ]
    };
    var result=parse_url(localStorage.getItem("jsonrpc_path") || "http://localhost:6800/jsonrpc");
    var auth=result[1];
    if (auth && auth.indexOf('token:') == 0) {
        rpc_data.params.unshift(auth);
    }
    var parameter = {'url': result[0], 'dataType': 'json', type: 'POST', data: JSON.stringify(rpc_data), 'headers': {'Authorization': auth}};
    HttpSendRead(parameter)
            .done(function(json, textStatus, jqXHR) {
                var opt={
                    type: "basic",
                    title: "下载成功",
                    message: "导出下载成功~",
                    iconUrl: "images/icon.jpg"
                }                    
                showNotification(opt);
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                var opt={
                    type: "basic",
                    title: "下载失败",
                    message: "导出下载失败! QAQ",
                    iconUrl: "images/icon.jpg"
                }                    
                showNotification(opt);
            }); 
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading') {
    	var path = localStorage.getItem("jsonrpc_path") || "http://localhost:6800/jsonrpc";
    	chrome.contextMenus.removeAll();
    	addContextMenu(chrome.runtime.id,"YAAW");
    }
       
});
chrome.browserAction.onClicked.addListener(function(){
    var index=chrome.extension.getURL('yaaw/index.html');
    chrome.tabs.getAllInWindow(undefined, function(tabs) {
    for (var i = 0, tab; tab = tabs[i]; i++) {
        if (tab.url && tab.url == index) {
            chrome.tabs.update(tab.id, {selected: true});
            return;
        }
    }
    chrome.tabs.create({url:index});
    });
     
});