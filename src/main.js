// Support both the WebSocket and MozWebSocket objects
if ((typeof(WebSocket) == 'undefined') && (typeof(MozWebSocket) != 'undefined')) {
	  WebSocket = MozWebSocket;
}

var Touchscreen = (function () {

	var module = {};
	
	module.init = function() {
		LeapBootstrap.init();
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
			module.capturedPoints.push(module.currentFrame.pointables[0].tipPosition);
			module.output.append('Point captured ' + module.currentFrame.pointables[0].tipPosition[2] + '<br>');
			if (module.capturedPoints.length > 2) module.initPlane();
		}
	
	};

	module.initPlane = function() {
		this.plane = new Plane(this.capturedPoints[0],this.capturedPoints[1],this.capturedPoints[2]);
	};
	
	return module;
})();