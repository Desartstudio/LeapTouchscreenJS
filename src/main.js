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
	module.points = [];
	
	module.calibrate1 = function() {
		var p = module.controller.frame().pointables();
		if(p.count()==1){
			var point = p[0].tipPosition();
			module.points[0] = point;
			module.output.append(point + '<br>');
			$('#point1')[0].style.visibility = 'hidden';
			$('#point2')[0].style.visibility = 'visible';
			$('#calibrate').off('click');
			$('#calibrate').on('click', module.calibrate2);
		}
	}
	
	module.calibrate2 = function() {
		var p = module.controller.frame().pointables();
		if(p.count()==1){
			var point = p[0].tipPosition();
			module.points[1] = point;
			module.output.append(point + '<br>');
			$('#point2')[0].style.visibility = 'hidden';
			$('#point3')[0].style.visibility = 'visible';
			$('#calibrate').off('click');
			$('#calibrate').on('click', module.calibrate3);
		}
	}
	
	module.calibrate3 = function() {
		var p = module.controller.frame().pointables();
		if(p.count()==1){
			var point = p[0].tipPosition();
			module.points[2] = point;
			module.output.append(point + '<br>');
			$('#point3')[0].style.visibility = 'hidden';
			$('#calibrate').off('click');
			module.initPlane();
		}
	}

	module.initView = function () {
	
		this.output = $('#output');
		$('#calibrate').on('click', function(){
			$('#point1')[0].style.visibility = 'visible';
			$('#calibrate').on('click', module.calibrate1);
		});
	};
	
	module.translateToScreen = function(point){
		var direction = point.minus(this.screen.origin);
		var y = this.screen.yu.dot(direction);
		var x = this.screen.xu.dot(direction);
		return {x: x, y: y};
	};

	module.initPlane = function() {
		
		this.plane = new Plane(this.points[0],this.points[1],this.points[2]);
		
		this.screen = {};
		this.screen.center = this.points[0].plus(this.points[2]).dividedBy(2);
		this.screen.origin = this.points[1].plus(this.points[1].minus(this.screen.center));
		var yv = this.points[0].minus(this.points[1]);
		var xv = this.points[2].minus(this.points[0]);
		var yscale = 4*yv.magnitude()/document.height;
		var xscale = 2*xv.magnitude()/document.width;
		this.screen.yu = yv.normalized().dividedBy(yscale);
		this.screen.xu = xv.normalized().dividedBy(xscale);
		
		this.listener.onFrame = function(controller){
			var pointableList = controller.frame().pointables();
			var isHit = false;
			
			for(index = 0; index < pointableList.count(); index++){
			
				var pointable = pointableList[index];
				var hit = Touchscreen.plane.pointIntersect(pointable.tipPosition());
	
				if (hit && hit.distance < 10) {
					isHit = true;
					
					var screenHit = module.translateToScreen(hit.position);
					var el = document.createElement("div");
					el.classList.add("art");
					el.style.cssText = "left:"+screenHit.x+"px;top:"+screenHit.y+"px;";
					document.body.appendChild(el);
				}
			}
			
			//console.log(isHit);
		
			//if (isHit) {
			//	$('body').css('background-color','#ccc');
			//} else {
			//	$('body').css('background-color','#fff');
			//}
		};
		
	};
	
	return module;
})();