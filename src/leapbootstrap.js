
var LeapBootstrap = (function () {

	var module = {};

	module.init = function () {
	  // Create the socket with event handlers
	  // Create and open the socket
	  var ws = new WebSocket("ws://localhost:6437/");
	  
	  // On successful connection
	  ws.onopen = function(event) {
		document.getElementById("main").style.visibility = "visible";
		document.getElementById("connection").innerHTML = "WebSocket connection open!";
	  };
	  
	  // On message received
	  ws.onmessage = function(event) {
		Touchscreen.currentFrame = JSON.parse(event.data);
	
		if (Touchscreen.plane) {
			if (Touchscreen.currentFrame.pointables[0]) {

				var hitPoint = Touchscreen.plane.pointIntersect(Touchscreen.currentFrame.pointables[0].tipPosition);
	
				if (hitPoint.distance < 2) {
					$('body').css('background-color','#ccc');
				} else {
					$('body').css('background-color','#fff');
				}

			}
		}
	
	  };
	  
	  // On socket close
	  ws.onclose = function(event) {
		ws = null;
		document.getElementById("main").style.visibility = "hidden";
		document.getElementById("connection").innerHTML = "WebSocket connection closed";
	  }
	  
	  //On socket error
	  ws.onerror = function(event) {
		alert("Received error");
	  };
	}

	return module;
})();