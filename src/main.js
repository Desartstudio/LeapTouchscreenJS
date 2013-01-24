// Support both the WebSocket and MozWebSocket objects
if ((typeof(WebSocket) == 'undefined') && (typeof(MozWebSocket) != 'undefined')) {
	  WebSocket = MozWebSocket;
}

window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function( callback ){
        window.setTimeout(callback, 1000 / 60);
    };
})();

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
		var canvas = $('#canvas1')[0];
		canvas.width = document.width;
		canvas.height = document.height;
		this.context = canvas.getContext("2d");
        var bgcanvas = $('#canvas2')[0];
        bgcanvas.width = document.width;
        bgcanvas.height = document.height;
        this.bgcontext = bgcanvas.getContext("2d");
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
			$('#calibrate')[0].style.visibility = 'hidden';
			$('#connection')[0].style.visibility = 'hidden';
			$('#canvas1')[0].style.visibility = 'visible';
            $('#canvas2')[0].style.visibility = 'visible';
			setTimeout( function(){ module.initPlane(); }, 500);
		}
	}

	module.initView = function () {
	
		this.output = $('#output');
		$('#calibrate').on('click', function(){
			$('#point1')[0].style.visibility = 'visible';
			$('#calibrate').off('click');
			$('#calibrate').on('click', module.calibrate1);
		});
	};
	
	module.translateToScreen = function(point){
		var direction = point.minus(this.screen.origin);
		var y = this.screen.yu.dot(direction);
		var x = this.screen.xu.dot(direction);
		return {x: x, y: y};
	};
                   
    module.drawLoop = function(){
        requestAnimFrame(module.drawLoop);
        module.context.drawImage(module.buffer1, 0, 0);
        module.bgcontext.drawImage(module.buffer2, 0, 0);
        module.buffercx2.fillStyle = 'rgba(255,255,255,.2)';
        module.buffercx2.fillRect(0,0,document.width,document.height);
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
                   
        this.buffer1 = document.createElement('canvas');
        this.buffer1.width = document.width;
        this.buffer1.height = document.height;
        this.buffercx1 = this.buffer1.getContext('2d');
        
        this.buffer2 = document.createElement('canvas');
        this.buffer2.width = document.width;
        this.buffer2.height = document.height;
        this.buffercx2 = this.buffer2.getContext('2d');
		
		this.listener.onFrame = function(controller){
			var pointableList = controller.frame().pointables();
			var lastPointableList = controller.frame(1).pointables();
			var isHit = false;
			
			for(index = 0; index < pointableList.count(); index++){
			
				var pointable = pointableList[index];
				var project = Touchscreen.plane.rayIntersect(pointable.tipPosition(), pointable.direction());
				
				if(project){
					var screenHit = module.translateToScreen(project.position);
					
					module.buffercx2.beginPath();
					module.buffercx2.arc(screenHit.x, screenHit.y, 10, 0, 2 * Math.PI, false);
					module.buffercx2.fillStyle = 'rgba(225,225,225,1)';
					module.buffercx2.fill();
					
					if(index < lastPointableList.count()){
						var lastPointable = lastPointableList[index];
						var lastProject = Touchscreen.plane.rayIntersect(lastPointable.tipPosition(), lastPointable.direction());
						
						if(lastProject && project.distance < 40 && project.distance > -40 && lastProject.distance < 40 && lastProject.distance > -40){
							var lastHit = module.translateToScreen(lastProject.position);
							
							var size = (80 - project.distance - lastProject.distance)/2;
							module.buffercx1.beginPath();
							module.buffercx1.moveTo(lastHit.x, lastHit.y);
							module.buffercx1.lineTo(screenHit.x, screenHit.y);
							module.buffercx1.lineWidth = size;
							module.buffercx1.strokeStyle = 'rgba(0,0,0,1)';
							module.buffercx1.stroke();
							
							module.buffercx1.beginPath();
							module.buffercx1.arc(screenHit.x, screenHit.y, size/2, 0, 2 * Math.PI, false);
							module.buffercx1.fillStyle = 'rgba(0,0,0,1)';
							module.buffercx1.fill();
							
							module.buffercx1.beginPath();
							module.buffercx1.arc(lastHit.x, lastHit.y, size/2, 0, 2 * Math.PI, false);
							module.buffercx1.fillStyle = 'rgba(0,0,0,1)';
							module.buffercx1.fill();
						}
					}
					else{
						
					}
				}
			}
			
			//console.log(isHit);
		
			//if (isHit) {
			//	$('body').css('background-color','#ccc');
			//} else {
			//	$('body').css('background-color','#fff');
			//}
		};
        
        requestAnimFrame(module.drawLoop);
		
	};
	
	return module;
})();