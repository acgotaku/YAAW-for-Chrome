$(function(){
	$("#add-rpc").on("click",function(){
		var rpc_form='<div class="control-group rpc">'+
            '<label class="control-label">JSON-RPC</label>'+
            '<div class="controls">'+
              '<input type="text" class="input-small" id="rpc-name" placeholder="RPC Name">'+
              '<input type="text" class="input-xlarge rpc-path" id="rpc-path" placeholder="RPC Path"></div></div>';
        $(rpc_form).insertAfter($(".rpc_list"));
	});
});