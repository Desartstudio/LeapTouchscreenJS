// Support both the WebSocket and MozWebSocket objects
if ((typeof(WebSocket) == 'undefined') && (typeof(MozWebSocket) != 'undefined')) {
	  WebSocket = MozWebSocket;
}

var Touchscreen = (function () {

	var module = {};
	
	module.init = function() {
		this.listener = new Leap.Listener();
		this.listener.onConnect = function(controller) {
			document.getElementById("main").style.visibility = "visible";
			document.getElementById("connection").innerHTML = "WebSocket connection open!";
		};
		this.controller = new Leap.Controller("ws://localhost:6437/");
		this.controller.addListener(this.listener);
		this.initView();
	}
	
	module.output = null;
	module.plane = null;	
	module.normals = [];
	
	module.calibrate1 = function() {
		var point = module.controller.frame().pointables()[0].tipPosition();
		module.normals[0] = point;
		module.output.append(point + '<br>');
		document.getElementById('point1').style.visibility = 'hidden';
		document.getElementById('point2').style.visibility = 'visible';
		$('#calibrate').off('click');
		$('#calibrate').on('click', module.calibrate2);
	}
	
	module.calibrate2 = function() {
		var point = module.controller.frame().pointables()[0].tipPosition();
		module.normals[1] = point;
		module.output.append(point + '<br>');
		document.getElementById('point2').style.visibility = 'hidden';
		document.getElementById('point3').style.visibility = 'visible';
		$('#calibrate').off('click');
		$('#calibrate').on('click', module.calibrate3);
	}
	
	module.calibrate3 = function() {
		var point = module.controller.frame().pointables()[0].tipPosition();
		module.normals[2] = point;
		module.output.append(point + '<br>');
		document.getElementById('point3').style.visibility = 'hidden';
		$('#calibrate').off('click');
		module.initPlane();
	}

	module.initView = function () {
	
		this.output = $('#output');
		$('#calibrate').on('click', function(){
			document.getElementById('point1').style.visibility = 'visible';
			$('#calibrate').on('click', module.calibrate1);
		});
	};

	module.initPlane = function() {
		
		this.plane = new Plane(this.normals[0],this.normals[1],this.normals[2]);
		
		this.listener.onFrame = function(controller){
			var pointableList = controller.frame().pointables();
			var isHit = false;
			
			for(index = 0; index < pointableList.count(); index++){
			
				var pointable = pointableList[index];
				var hit = Touchscreen.plane.pointIntersect(pointable.tipPosition());
	
				if (hit && hit.distance < 10) {
					isHit = true;
				}
			}
			
			//console.log(isHit);
		
			if (isHit) {
				$('body').css('background-color','#ccc');
			} else {
				$('body').css('background-color','#fff');
			}
		};
		
	};
	
	return module;
})();