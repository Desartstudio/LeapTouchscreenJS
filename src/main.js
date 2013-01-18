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
	module.currentFrame = {};	
	module.capturedPoints = [];

	module.initView = function () {
		this.output = $('#output');

		$('#calibrate').on('click', function() {
			Touchscreen.capturedPoints.length = 0;
			module.output.empty();
			setTimeout(captureCalibratePoint, 1500);
			setTimeout(captureCalibratePoint, 2700);
			setTimeout(captureCalibratePoint, 4300);
		});
	
		function captureCalibratePoint() {
			var point = module.controller.frame().pointables()[0].tipPosition();
			module.capturedPoints.push(point);
			module.output.append(point + '<br>');
			if (module.capturedPoints.length > 2) module.initPlane();
		}
	
	};

	module.initPlane = function() {
		this.plane = new Plane(this.capturedPoints[0],this.capturedPoints[1],this.capturedPoints[2]);
		
		this.listener.onFrame = function(controller){
			var pointableList = controller.frame().pointables();
			var isHit = false;
			
			for(index = 0; index < pointableList.count(); index++){
			
				var pointable = pointableList[index];
				var hit = Touchscreen.plane.rayIntersect(pointable.tipPosition(), pointable.direction());
	
				if (hit && hit.distance < 2) {
					isHit = true;
				}
			}
			
			console.log(isHit);
		
			if (isHit) {
				$('body').css('background-color','#ccc');
			} else {
				$('body').css('background-color','#fff');
			}
		};
		
	};
	
	return module;
})();