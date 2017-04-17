const defaultRPC='[{"name":"ARIA2 RPC","url":"http://localhost:6800/jsonrpc"}]';
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
function showNotification(id,opt){
    var notification = chrome.notifications.create(id,opt,function(notifyId){return notifyId});
    setTimeout(function(){
        chrome.notifications.clear(id,function(){});
    },3000);
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

function aria2Send(link,url,output){
    chrome.cookies.getAll({"url":link}, function(cookies) {
        var format_cookies = [];
        for (var i in cookies) {
            var cookie = cookies[i];
            format_cookies.push(cookie.name +"="+cookie.value);
        }
        var header=[];
        header.push("Cookie: " + format_cookies.join("; "));
        header.push("User-Agent: " + navigator.userAgent);
        header.push("Connection: keep-alive");
        var rpc_data = {
            "jsonrpc": "2.0",
            "method": "aria2.addUri",
            "id": new Date().getTime(),
            "params": [[link],{
                "header":header
            }]
        };
        if (output)
        rpc_data.params[1]["out"]=output;
        var result=parse_url(url);
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
                    var id= new Date().getTime().toString();                    
                    showNotification(id,opt);
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    console.log(jqXHR);
                    var opt={
                        type: "basic",
                        title: "下载失败",
                        message: "导出下载失败! QAQ",
                        iconUrl: "images/icon.jpg"
                    }      
                    var id= new Date().getTime().toString();                    
                    showNotification(id,opt);
                }); 
    });

}

function matchRule(str, rule) {
  return new RegExp("^" + rule.split("*").join(".*") + "$").test(str);
}

function isCapture(downloadItem){
    var fileSize =localStorage.getItem("fileSize");
    var white_site =JSON.parse(localStorage.getItem("white_site"));
    var black_site =JSON.parse(localStorage.getItem("black_site"));
    var url =downloadItem.referrer|| downloadItem.url;

    if(downloadItem.error || downloadItem.state != "in_progress" || url.startsWith("http") == false){
        return false;
    }

    var parse_url=/^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
    var result=parse_url.exec(url)[3];

    for (var i=0; i< white_site.length;i++){
        if(matchRule(result,white_site[i])){
            return true;
        }
    }

    for (var i=0; i< black_site.length;i++){
        if(matchRule(result,black_site[i])){
            return false;
        }
    }


    if(downloadItem.fileSize >= fileSize*1024*1024){
        return true;
    }else{
        return false;
    }
}
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    aria2Send(info.linkUrl,info.menuItemId,null);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading') {
        chrome.contextMenus.removeAll();
        var contextMenus=localStorage.getItem("contextMenus");
        if(contextMenus == "true" || contextMenus == null){
            var rpc_list=JSON.parse(localStorage.getItem("rpc_list")||defaultRPC);
            for(var i in rpc_list){
                addContextMenu(rpc_list[i]['url'],rpc_list[i]['name']);
            }
            localStorage.setItem("contextMenus", true);             
        }
    }
       
});

chrome.downloads.onDeterminingFilename.addListener(function(downloadItem){
    var integration =localStorage.getItem("integration");
    if(integration == "true" && isCapture(downloadItem)){
        var rpc_list=JSON.parse(localStorage.getItem("rpc_list")||defaultRPC);
        console.log(decodeURIComponent(downloadItem.filename));
        aria2Send(downloadItem.url,rpc_list[0]['url'],decodeURIComponent(downloadItem.filename).split(/[\/\\]/).pop());
        //chrome.downloads.cancel(downloadItem.id,function(){});
    }
});

chrome.downloads.onCreated.addListener(function(downloadItem){
    var integration =localStorage.getItem("integration");
    if(integration == "true" && isCapture(downloadItem)){
        var rpc_list=JSON.parse(localStorage.getItem("rpc_list")||defaultRPC);
        console.log(decodeURIComponent(downloadItem.filename));
        //aria2Send(downloadItem.url,rpc_list[0]['url'],decodeURIComponent(downloadItem.filename).split(/[\/\\]/).pop());
        chrome.downloads.cancel(downloadItem.id,function(){});
    }
});


/*
chrome.webRequest.onHeadersReceived.addListener(function(details){
    for (var i = 0; i < details.responseHeaders.length; ++i) {
        if (details.responseHeaders[i].name === 'Content-Type' && details.responseHeaders[i].value === 'application/octet-stream') {
            var item = details.responseHeaders;
            var flag = 0;
            var downloadItem ={url:null,name:null,fileSize:0};
            item.filter(function(obj){
                if(obj.name === 'Content-Length' && obj.value == 0){
                    flag++;
                }
                if(obj.name === 'Content-Transfer-Encoding' || obj.name == 'Transfer-Encoding'|| obj.name == 'Content-Encoding'){
                    flag++;
                } 
                if(obj.name === 'Content-Disposition'){
                    downloadItem.name= decodeURIComponent(obj.value.split("=")[1]);
                }
                if(obj.name === 'Content-Length'){
                    downloadItem.fileSize= obj.value;
                }
            });
            if(!flag){
                downloadItem.url = details.url;
                var integration =localStorage.getItem("integration");
                if(integration == "true" && isCapture(downloadItem)){
                    var rpc_list=JSON.parse(localStorage.getItem("rpc_list")||defaultRPC);
                    aria2Send(downloadItem.url,rpc_list[0]['url'],null);
                }
                return {cancel: true};
            }
        }
    }

},{urls: ["<all_urls>"]}, ["blocking","responseHeaders"]);
*/
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

//软件版本更新提示
var manifest = chrome.runtime.getManifest();
var previousVersion=localStorage.getItem("version");
if(previousVersion == "" || previousVersion != manifest.version){
    var opt={
        type: "basic",
        title: "更新",
        message: "YAAW for Chrome更新到" + manifest.version + "版本啦～\n此次更新支持通配符匹配~",
        iconUrl: "images/icon.jpg"
    };
    var id= new Date().getTime().toString();
    showNotification(id,opt);
    localStorage.setItem("version",manifest.version);
}