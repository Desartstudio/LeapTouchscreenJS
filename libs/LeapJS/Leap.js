var Leap = { APIVersion : "0.7.1" };

Leap.Controller = function(connection){
	
	this._frames = [];
	this._listeners = {};
	this._listenerId = 0;
	
	this._bufferSize = 1024;
	this._bufferBegin = 0;
	
	for(var index = 0; index < this._bufferSize; index++) this._frames[index] = Leap.Frame.invalid();
	
	if ((typeof(WebSocket) == 'undefined') && (typeof(MozWebSocket) != 'undefined')) WebSocket = MozWebSocket;
	
	if (typeof(WebSocket) != 'undefined'){
		
		this._socket = new WebSocket(connection);
		this._socket._controller = this;
		
		this._socket.onmessage = function(event){
			this._controller._versionFrame(event);
		};
		
		this._socket.onopen = function(event){
			for(index in this._controller._listeners)
				this._controller._listeners[index].onConnect(this._controller);
		};
		
		this._socket.onclose = function(event){
			for(index in this._controller._listeners)
				this._controller._listeners[index].onDisconnect(this._controller);
		};
		
		this._socket.onerror = function(event){ 
			this.onclose(event);
		};
	}
};

Leap.Controller.prototype = {
	
	isConnected : function(){
		return this._socket.connected;
	},
	
	frame : function(index){
		if(index == null || index == 0) return this._frames[this._bufferBegin];
		if(index > this._bufferSize - 1) return Leap.Frame.invalid();
		
		index = this._bufferBegin-index;
		if(index < 0) index += this._bufferSize;
		return this._frames[index];
	},
	
	addListener : function(listener){
		listener._id = this._listenerId++;
		this._listeners[listener._id] = listener;
		listener.onInit(this);
	},
	
	removeListener : function(listener){
		listener.onExit(this);
		this._listeners[listener._id].onExit(this);
		delete this._listeners[listener._id];
	},
	
	config : function(){
		// Requires additional data form WebSocket server
	},
	
	calibratedScreens : function(){
		// Requires additional data from WebSocket server
	},
	
	_onmessage : function(event){
		
		var eventData = JSON.parse(event.data);
		var newFrame = new Leap.Frame(eventData);
		
		this._bufferBegin++;
		if(this._bufferBegin == this._bufferSize) this._bufferBegin = 0;
		
		delete this._frames[this._bufferBegin];
		this._frames[this._bufferBegin] = newFrame;
		
		for(index in this._listeners)
			this._listeners[index].onFrame(this);
	},
	
	_versionFrame : function(event){
		Leap.serverVersion = JSON.parse(event.data).version;
		this._socket.onmessage = function(event){ this._controller._onmessage(event); };
	}
};

Leap.Frame = function(frameData){

	this._fingers = new Leap.FingerList();
	this._tools = new Leap.ToolList();
	this._pointables = new Leap.PointableList();
	this._hands = new Leap.HandList();
	
	this._fingerTable = {};
	this._toolTable = {};
	this._pointableTable = {};
	this._handTable = {};

	if(frameData == null){
		this._id = null;
		this._timestamp = null;
		this._valid = false;
		
		this._rotation = new Leap.Matrix();
		this._scale = null;
		this._translation = new Leap.Vector();
	}
	else{
		this._id = frameData.id;
		this._timestamp = frameData.timestamp;
		this._valid = true;
		
		this._rotation = new Leap.Matrix(frameData.r);
		this._scale = frameData.s;
		this._translation = new Leap.Vector(frameData.t);
		
		for(index in frameData.hands){
		
			var newHand = new Leap.Hand(frameData.hands[index],this)
			this._handTable[newHand._id] = newHand;
			this._hands.push(newHand);
		}
		
		for(index in frameData.pointables){
			var hand = this._handTable[frameData.pointables[index].handId];
			if(frameData.pointables[index].tool){
				var pointable = new Leap.Tool(frameData.pointables[index],hand);
				this._pointableTable[pointable._id] = this._toolTable[pointable._id] = pointable;
				this._pointables.push(pointable);
				this._tools.push(pointable);
				if(hand){
					hand._pointableTable[pointable._id] = hand._toolTable[pointable._id] = pointable;
					hand._pointables.push(pointable);
					hand._tools.push(pointable);
				}
			}
			else{
				var pointable = new Leap.Finger(frameData.pointables[index],hand);
				this._pointableTable[pointable._id] = this._fingerTable[pointable._id] = pointable;
				this._pointables.push(pointable);
				this._fingers.push(pointable);
				if(hand){
					hand._pointableTable[pointable._id] = hand._fingerTable[pointable._id] = pointable;
					hand._pointables.push(pointable);
					hand._fingers.push(pointable);
				}
			}
		}
	}
};

Leap.Frame.prototype = {
	
	id : function(){
		return this._id;
	},
	
	timestamp : function(){
		return this._timestamp;
	},
	
	rotationAngle : function(sinceFrame, axis){
		// TODO: implement axis parameter
		if (!this._valid || !sinceFrame._valid) return 0.0;
		var rot = this.rotationMatrix(sinceFrame);
		var cs = (rot.xBasis.x + rot.yBasis.y + rot.zBasis.z - 1.0)*0.5
		var angle = Math.acos(cs);
		return angle === NaN ? 0.0 : angle;
	},
	
	rotationAxis : function(sinceFrame){
		if (!this._valid || !sinceFrame._valid) return Leap.Vector.zero();
		var x = this._rotation.zBasis.y - sinceFrame._rotation.yBasis.z;
		var y = this._rotation.xBasis.z - sinceFrame._rotation.zBasis.x;
		var z = this._rotation.yBasis.x - sinceFrame._rotation.xBasis.y;
		var vec = new Leap.Vector([x, y, z]);
		return vec.normalize();
	},
	
	rotationMatrix : function(sinceFrame){
		if (!this._valid || !sinceFrame._valid) return Leap.Matrix.identity();
		var xBasis = new Leap.Vector([this._rotation.xBasis.x, this._rotation.yBasis.x, this._rotation.zBasis.x]);
		var yBasis = new Leap.Vector([this._rotation.xBasis.y, this._rotation.yBasis.y, this._rotation.zBasis.y]);
		var zBasis = new Leap.Vector([this._rotation.xBasis.z, this._rotation.yBasis.z, this._rotation.zBasis.z]);
		var transpose = new Leap.Matrix([xBasis, yBasis, zBasis]);
		return sinceFrame._rotation.multiply(transpose);
	},
	
	scaleFactor : function(sinceFrame){
		if (!this._valid || !sinceFrame._valid) return 1.0;
		return Math.exp(this._scale - sinceFrame._scale);
	},
	
	translation : function(sinceFrame){
		if (!this.valid || !sinceFrame.valid) return Leap.Vector.zero();
		var x = this._translation.x - sinceFrame._translation.x;
		var y = this._translation.y - sinceFrame._translation.y;
		var z = this._translation.z - sinceFrame._translation.z;
		return new Leap.Vector([x, y, z]);
	},
	
	finger : function(id){
		if(this._fingerTable[id]==null) return Leap.Finger.invalid();
		return this._fingers[id];
	},
	
	fingers : function(){
		return this._fingers;
	},
	
	hand : function(id){
		if(this._handTable[id]==null) return Leap.Hand.invalid();
		return this._handTable[id];
	},
	
	hands : function(){
		return this._hands;
	},
	
	pointable : function(id){
		if(this._pointableTable[id]==null) return Leap.Pointable.invalid();
		return this._pointableTable[id];
	},
	
	pointables : function(){
		return this._pointables;
	},
	
	tool : function(id){
		if(this._toolTable[id]==null) return Leap.Tool.invalid();
		return this._toolTable[id];
	},
	
	tools : function(){
		return this._tools;
	},
	
	pointables : function(){
		return this._pointables;
	},
	
	compare : function(other){
		return this._id==other.id;
	},
	
	toString : function(){
		var val = "{timestamp:"+this._timestamp+",id:"+this._id+",hands:[";
		for(var i=0; i < this._hands.length; i++) val += this._hands[i].toString();
		val += "]}";
		return val;
	},
	
	isValid : function(){ return this._valid; }
};

Leap.Frame.invalid = function(){
	return new Leap.Frame();
};

Leap.Hand = function(handData, parentFrame){
	
	this._fingers = new Leap.FingerList();
	this._tools = new Leap.ToolList();
	this._pointables = new Leap.PointableList();
	
	this._fingerTable = {};
	this._toolTable = {};
	this._pointableTable = {};
	
	if(handData == null){
	
		this._frame = null;
		this._id = null;
		this._valid = false;
		
		this._rotation = new Leap.Matrix();
		this._scale = null;
		this._translation = new Leap.Vector();
		
		this._direction = new Leap.Vector();
		this._palmNormal = new Leap.Vector();
		this._palmPosition = new Leap.Vector();
		this._palmVelocity = new Leap.Vector();
		this._sphereCenter = new Leap.Vector();
		this._sphereRadius = null;
	}
	else{
		
		this._frame = parentFrame;
		this._id = handData.id;
		this._valid = true;
		
		this._rotation = new Leap.Matrix(handData.r);
		this._scale = handData.s;
		this._translation = new Leap.Vector(handData.t);
		
		this._direction = new Leap.Vector(handData.direction);
		this._palmNormal = new Leap.Vector(handData.palmNormal);
		this._palmPosition = new Leap.Vector(handData.palmPosition);
		this._palmVelocity = new Leap.Vector(handData.palmVelocity);
		this._sphereCenter = new Leap.Vector(handData.sphereCenter);
		this._sphereRadius = handData.sphereRadius;
	}
};

Leap.Hand.prototype = {
	
	frame : function(){
		return this._frame;
	},
	
	id : function(){
		return this._id;
	},
	
	direction : function(){
		return this._direction;
	},
	
	palmNormal : function(){
		return this._palmNormal;
	},
	
	palmPosition : function(){
		return this._palmPosition;
	},
	
	palmVelocity : function(){
		return this._palmVelocity;
	},
	
	sphereCenter : function(){
		return this._sphereCenter;
	},
	
	sphereRadius : function(){
		return this._sphereRadius;
	},
	
	rotationAngle : function(sinceFrame, axis){
		// TODO: implement axis parameter
		if (!this._valid || !sinceFrame._valid) return 0.0;
		var rot = this.rotationMatrix(sinceFrame);
		var cs = (rot.xBasis.x + rot.yBasis.y + rot.zBasis.z - 1.0)*0.5
		var angle = Math.acos(cs);
		return angle === NaN ? 0.0 : angle;
	},
	
	rotationAxis : function(sinceFrame){
		if (!this._valid || !sinceFrame._valid) return Leap.Vector.zero();
		var x = this._rotation.zBasis.y - sinceFrame._rotation.yBasis.z;
		var y = this._rotation.xBasis.z - sinceFrame._rotation.zBasis.x;
		var z = this._rotation.yBasis.x - sinceFrame._rotation.xBasis.y;
		var vec = new Leap.Vector([x, y, z]);
		return vec.normalize();
	},
	
	rotationMatrix : function(sinceFrame){
		if (!this._valid || !sinceFrame._valid) return Leap.Matrix.identity();
		var xBasis = new Leap.Vector([this._rotation.xBasis.x, this._rotation.yBasis.x, this._rotation.zBasis.x]);
		var yBasis = new Leap.Vector([this._rotation.xBasis.y, this._rotation.yBasis.y, this._rotation.zBasis.y]);
		var zBasis = new Leap.Vector([this._rotation.xBasis.z, this._rotation.yBasis.z, this._rotation.zBasis.z]);
		var transpose = new Leap.Matrix([xBasis, yBasis, zBasis]);
		return sinceFrame._rotation.multiply(transpose);
	},
	
	scaleFactor : function(sinceFrame){
		if (!this._valid || !sinceFrame._valid) return 1.0;
		return Math.exp(this._scale - sinceFrame._scale);
	},
	
	translation : function(sinceFrame){
		if (!this.valid || !sinceFrame.valid) return Leap.Vector.zero();
		var x = this._translation.x - sinceFrame._translation.x;
		var y = this._translation.y - sinceFrame._translation.y;
		var z = this._translation.z - sinceFrame._translation.z;
		return new Leap.Vector([x, y, z]);
	},
	
	finger : function(id){
		if(this._fingerTable[id]==null) return Leap.Finger.invalid();
		return this._fingerTable[id];
	},
	
	fingers : function(){
		return this._fingers;
	},
	
	pointable : function(id){
		if(this._pointableTable[id]==null) return Leap.Pointable.invalid();
		return this._pointableTable[id];
	},
	
	pointables : function(){
		return this._pointables;
	},
	
	tool : function(id){
		if(this._toolTable[id]==null) return {isValid:false};
		return this._toolTable[id];
	},
	
	tools : function(){
		return this._tools;
	},
	
	toString : function(){
		var val = "{id:"+obj._id+",sphereCenter:"+(obj._sphereCenter==null?"null":obj._sphereCenter)+",";
		val += "sphereRadius:"+(obj._sphereRadius==null?"null":obj._sphereRadius)+",";
		val += "normal:"+(obj._normal==undefined?"null":obj._normal.toString())+",fingers:[";
		for(var i=0; i < this._fingers.length; i++) val += this._fingers[i].toString();
		val += "],tools:[";
		for(var i=0; i < this._tools.length; i++) val += this._tools[i].toString();
		val += "],palmNormal:"+(obj._palmNormal==undefined?"null":obj._palmNormal.toString())+",";
		val += "palmPosition:"+(obj._palmPosition==undefined?"null":obj._palmPosition.toString())+",";
		val += "palmVelocity:"+(obj._palmVelocity==undefined?"null":obj._palmVelocity.toString())+"}";
		return val;
	},
	
	isValid : function(){
		return this._valid;
	}
};

Leap.Hand.invalid = function(){
	return new Leap.Hand();
};

Leap.HandList = function(){};

Leap.HandList.prototype = new Array;

Leap.HandList.prototype.append = function(other){

	for(i = 0; i < other.length; i++) this.push(new Leap.Hand(other[i]));
};

Leap.HandList.prototype.count = function(){

	return this.length;
};

Leap.HandList.prototype.empty = function(){

	return this.length > 0;
};

Leap.Listener = function(){
	
	this.onConnect = function(controller){};
	this.onDisconnect = function(controller){};
	this.onExit = function(controller){};
	this.onFrame = function(controller){};
	this.onInit = function(controller){};
};

Leap.Matrix = function(data){
	
	if(data instanceof Leap.Matrix){
		this.xBasis = new Leap.Vector(data.xBasis);
		this.yBasis = new Leap.Vector(data.yBasis);
		this.zBasis = new Leap.Vector(data.zBasis);
		this.origin = new Leap.Vector(data.origin);
	}
	else if(data instanceof Array){
		if(data[0] instanceof Leap.Vector && typeof(data[1]) == "number"){
			this.setRotation(data[0],data[1]);
			this.origin = new Leap.Vector(data[2]);
		}
		else{
			this.xBasis = new Leap.Vector(data[0]);
			this.yBasis = new Leap.Vector(data[1]);
			this.zBasis = new Leap.Vector(data[2]);
			this.origin = new Leap.Vector(data[3]);
		}
	}
	else{
		this.xBasis = new Leap.Vector([1,0,0]);
		this.yBasis = new Leap.Vector([0,1,0]);
		this.zBasis = new Leap.Vector([0,0,1]);
		this.origin = new Leap.Vector([0,0,0]);
	}
};

Leap.Matrix.prototype = {
	
	setRotation : function(_axis, angle){
		var axis = _axis.normalized();
		var s = Math.sin(angle);
		var c = Math.cos(angle);
		var C = 1-c;
		
		this.xBasis = new Leap.Vector([axis.x*axis.x*C + c, axis.x*axis.y*C - axis.z*s, axis.x*axis.z*C + axis.y*s]);
		this.yBasis = new Leap.Vector([axis.y*axis.x*C + axis.z*s, axis.y*axis.y*C + c, axis.y*axis.z*C - axis.x*s]);
		this.zBasis = new Leap.Vector([axis.z*axis.x*C - axis.y*s, axis.z*axis.y*C + axis.x*s, axis.z*axis.z*C + c]);
	},
	
	transformPoint : function(data){
		return this.origin.plus(this.transformDirection(data));
	},

	transformDirection : function(data){
		var x = this.xBasis.multiply(data.x);
		var y = this.yBasis.multiply(data.y);
		var z = this.zBasis.multiply(data.z);
		return x.plus(y).plus(z);
	},
	
	times : function(other){
		var x = this.transformDirection(other.xBasis);
		var y = this.transformDirection(other.yBasis);
		var z = this.transformDirection(other.zBasis);
		var o = this.transformPoint(other.origin);
		return new Leap.Matrix([x,y,z,o]);
	},
	
	rigidInverse : function(){
		var x = new Leap.Vector([this.xBasis.x, this.yBasis.x, this.zBasis.x]);
		var y = new Leap.Vector([this.xBasis.y, this.yBasis.y, this.zBasis.y]);
		var z = new Leap.Vector([this.xBasis.z, this.yBasis.z, this.zBasis.z]);
		var rotInverse = new Leap.Matrix([x,y,z]);
		rotInverse.origin = rotInverse.transformDirection(Leap.Vector.zero().minus(this.origin));
		return rotInverse;
	},
	
	toArray3x3 : function(output){
		if(output == null) output = [];
		else output.length = 0;
		output[0] = this.xBasis.x;
		output[1] = this.xBasis.y;
		output[2] = this.xBasis.z;
		output[3] = this.yBasis.x;
		output[4] = this.yBasis.y;
		output[5] = this.yBasis.z;
		output[6] = this.zBasis.x;
		output[7] = this.zBasis.y;
		output[8] = this.zBasis.z;
		return output;
	},
	
	toArray4x4 : function(output){
		if(output == null) output = [];
		else output.length = 0;
		output[0] = this.xBasis.x;
		output[1] = this.xBasis.y;
		output[2] = this.xBasis.z;
		output[3] = 0;
		output[4] = this.yBasis.x;
		output[5] = this.yBasis.y;
		output[6] = this.yBasis.z;
		output[7] = 0;
		output[8] = this.zBasis.x;
		output[9] = this.zBasis.y;
		output[10] = this.zBasis.z;
		output[11] = 0;
		output[12] = this.origin.x;
		output[13] = this.origin.y;
		output[14] = this.origin.z;
		output[15] = 1;
		return output;
	},
	
	toString : function(){
		return "{xBasis:"+this.xBasis+",yBasis:"+this.yBasis+
		",zBasis:"+this.zBasis+",origin:"+this.origin+"}";
	},
	
	compare : function(other){
		return this.xBasis.compare(other.xBasis) && 
		this.yBasis.compare(other.yBasis) && 
		this.zBasis.compare(other.zBasis) && 
		this.origin.compare(other.origin);
	}
};

Leap.Matrix.identity = function(){ return new Leap.Matrix(); };

Leap.Plane = function(point1, point2, point3){
	
	this._point1 = new Leap.Vector(point1);
	this._point2 = new Leap.Vector(point2);
	this._point3 = new Leap.Vector(point3);
};

Leap.Plane.prototype = {
	
	normal : function(){
		
		var x21 = this._point2.x - this._point1.x;
		var y21 = this._point2.y - this._point1.y;
		var z21 = this._point2.z - this._point1.z;
		
		var x31 = this._point3.x - this._point1.x;
		var y31 = this._point3.y - this._point1.y;
		var z31 = this._point3.z - this._point1.z;
		
		var x = y21*z31 - y31*z21;
		var y = x21*z31 - x31*z21;
		var z = x21*y31 - x31*y21;
		
		if(x==0 && y==0 && z==0) this._normal = null;
		else this._normal = new Leap.Vector([x, y, z]);
		
		this.normal = function(){ return this._normal; };
		return this._normal;
	},
	
	unitnormal : function(){
		
		var normal = this.normal();
		if(n==null) return null;
		
		this._unitnormal = n.normalized();
		
		this.unitnormal = function(){ return this._unitnormal; };
		return this._unitnormal;
	},
	
	pointIntersect : function(point){
		
		var unitnormal = this.unitnormal();
		var distance = unitnormal.dot(this._point1.minus(point));
		var position = unitnormal.multiply(distance).plus(point);
		
		return {position: position, distance: distance};
	},
	
	pointDistance : function(point){
		
		var unitnormal = this.unitnormal();
		var distance = unitnormal.dot(this._point1.minus(point));
		
		return distance;
	},
	
	rayIntersect : function(rayPosition, rayDirection){
		
		var d = rayDirection.dot(this.normal());
	
		if(d == 0) return null;
		
		var n = this._point1.minus(rayPosition).dot(this.normal());
		var t =  n/d;
		
		//if(t < 0) return null;
		
		var intersect = rayPosition.plus(rayDirection.multiply(t));
		var distance = t*rayDirection.magnitude();
		
		return {position: intersect, distance: distance};
	}
};

Leap.Pointable = function(pointableData, parentHand, obj){
	
	if(obj==null) obj = this;
	
	if(pointableData == null){
	
		obj._frame = null;
		obj._hand = null;
		obj._id = null;
		obj._valid = false;
		
		obj._direction = new Leap.Vector();
		obj._tipPosition = new Leap.Vector();
		obj._tipVelocity = new Leap.Vector();
		
		obj._length = null;
		obj._width = null;
	}
	else{
		
		obj._frame = (parentHand)?parentHand._frame:null;
		obj._hand = parentHand;
		obj._id = pointableData.id;
		obj._valid = true;
		
		obj._direction = new Leap.Vector(pointableData.direction);
		obj._tipPosition = new Leap.Vector(pointableData.tipPosition);
		obj._tipVelocity = new Leap.Vector(pointableData.tipVelocity);
		
		obj._length = pointableData.length;
		obj._width = pointableData.width;
	}
};

Leap.Pointable.prototype = {

	frame : function(){
		return this._frame;
	},
	
	hand : function(){
		return this._hand;
	},
	
	id : function(){
		return this._id;
	},
	
	direction : function(){
		return this._direction;
	},
	
	tipPosition : function(){
		return this._tipPosition;
	},
	
	tipVelocity : function(){
		return this._tipVelocity;
	},
	
	length : function(){
		return this._length;
	},
	
	width : function(){
		return this._width;
	},
	
	toString : function(){
		var val = "{id:"+this._id+",direction:"+this._direction.toString()+",";
		val += "tipPosition:"+this._tipPosition.toString()+",";
		val += "tipVelocity:"+this._tipVelocity.toString()+",";
		val += "length:"+this._length+",";
		val += "width:"+this._width+"}";
		return val;
	},
	
	isValid : function(){
		return this._valid;
	}
};

Leap.Pointable.invalid = function(){
	return new Leap.Pointable();
};

Leap.Finger = function(fingerData, parentHand){
	
	Leap.Pointable(fingerData, parentHand, this);
	
	this._isFinger = true;
	this._isTool = false;
};

Leap.Finger.prototype = Leap.Pointable.prototype;

Leap.Finger.invalid = function(){
	return new Leap.Finger();
};

Leap.Tool = function(toolData, parentHand){

	Leap.Pointable(toolData, parentHand, this);
	
	this._isTool = true;
	this._isFinger = false;
};

Leap.Tool.prototype = Leap.Pointable.prototype;

Leap.Tool.invalid = function(){
	return new Leap.Tool();
};

Leap.PointableList = function(){};

Leap.PointableList.prototype = new Array;

Leap.PointableList.prototype.append = function(other){
	for(i=0; i<other.length; i++) this.push(new Leap.Pointable(other[i]));
};

Leap.PointableList.prototype.count = function(){
	return this.length;
};

Leap.PointableList.prototype.empty = function(){
	return this.length>0;
};

Leap.FingerList = function(){};

Leap.FingerList.prototype = new Array;

Leap.FingerList.prototype.append = function(other){
	for(i = 0; i < other.length; i++) this.push(new Leap.Finger(other[i]));
};

Leap.FingerList.prototype.count = function(){
	return this.length;
};

Leap.FingerList.prototype.empty = function(){
	return this.length > 0;
};

Leap.ToolList = function(){};

Leap.ToolList.prototype = new Array;

Leap.ToolList.prototype.append = function(other){
	for(i=0; i<other.length; i++) this.push(new Leap.Tool(other[i]));
};

Leap.ToolList.prototype.count = function(){
	return this.length;
};

Leap.ToolList.prototype.empty = function(){
	return this.length>0;
};

Leap.Screen = function(data){
	
	if(data){
	
		this._plane = new Leap.Plane(data[0],data[1],data[2]);
		this._center = data[0].plus(data[2]).dividedBy(2);
		this._origin = data[1].plus(data[1].minus(this._center));
		
		var xv = data[2].minus(data[0]);
		var yv = data[0].minus(data[1]);
		var xscale = 2*xv.magnitude()/document.width;
		var yscale = 4*yv.magnitude()/document.height;
		this._xspan = xv.normalized().dividedBy(xscale);
		this._yspan = yv.normalized().dividedBy(yscale);
		
		this._valid = true;
	}
	else{
	
		this._plane = null;
		this._valid = false;
	}
};

Leap.Screen.prototype = {
	
	distanceToPoint : function(point){
		return this._plane.pointDistance(point);
	},
	
	intersect : function(pointable, normalize, clampRatio){
		// TODO: Implement clampRatio
		var intersect = this._plane.rayIntersect(pointable.tipPosition(), pointable.direction());
		
		if(normalize){ // Normalizes to 2D pixels
			var direction = intersect.position.minus(this._origin);
			var x = this._xspan.dot(direction);
			var y = this._yspan.dot(direction);
			intersect.position = new Leap.Vector([x, y, 0]);
		}
		
		return intersect;
	},
	
	normal : function(){
		return this._plane.normal();
	},
	
	isValid : function(){
		return this._valid;
	}
};

Leap.invalid = function(){ return new Leap.Screen(); };
Leap.Vector = function(data){
	
	if(data instanceof Leap.Vector){
		this.x = data.x;
		this.y = data.y;
		this.z = data.z;
	}
	else if(data != null){
		this.x = (typeof(data[0]) == "number")?data[0]:0;
		this.y = (typeof(data[1]) == "number")?data[1]:0;
		this.z = (typeof(data[2]) == "number")?data[2]:0;
	}
	else{
		this.x = 0;
		this.y = 0;
		this.z = 0;
	}
};

Leap.Vector.prototype = {
	
	angleTo : function(other){
		var denom = this.magnitude()*other.magnitude();
		if(denom > 0) return Math.acos(this.dot(other)/denom);
		else return 0;
	},
	
	cross : function(other){
		var x = this.y*other.z - other.y*this.z;
		var y = this.x*other.z - other.x*this.z;
		var z = this.x*other.y - other.x*this.y;
		return new Leap.Vector([x,y,z]);
	},
	
	distanceTo : function(other){
		return this.minus(other).magnitude();
	},
	
	dot : function(other){
		return this.x*other.x + this.y*other.y + this.z*other.z;
	},
	
	plus : function(other){
		return new Leap.Vector([this.x + other.x,this.y + other.y,this.z + other.z]);
	},
	
	minus : function(other){
		return new Leap.Vector([this.x - other.x,this.y - other.y,this.z - other.z]);
	},
	
	multiply : function(scalar){
		return new Leap.Vector([this.x*scalar,this.y*scalar,this.z*scalar]);
	},
	
	dividedBy : function(scalar){
		return new Leap.Vector([this.x/scalar,this.y/scalar,this.z/scalar]);
	},
	
	magnitude : function(){
		return Math.sqrt(this.magnitudeSquared());
	},
	
	magnitudeSquared : function(){
		return Math.pow(this.x,2) + Math.pow(this.y,2) + Math.pow(this.z,2);
	},
	
	normalized : function(){
		var magnitude = this.magnitude();
		if(magnitude > 0) return this.dividedBy(magnitude);
		else return new Leap.Vector();
	},
	
	pitch : function(){
		//var proj = new Leap.Vector([0,this.y,this.z]);
		//return Leap.vectors.forward().angleTo(proj);
		return Math.atan2(this.y, -this.z);
	},
	
	roll : function(){
		//var proj = new Leap.Vector([this.x,this.y,0]);
		//return Leap.vectors.down().angleTo(proj);
		return Math.atan2(this.x, -this.y);
	},
	
	yaw : function(){
		//var proj = new Leap.Vector([this.x,0,this.z]);
		//return Leap.vectors.forward().angleTo(proj);
		return Math.atan2(this.x, -this.z);
	},
	
	toArray : function(){
		return [this.x, this.y, this.z];
	},
	
	toString : function(){
		return "{x:"+this.x+",y:"+this.y+",z:"+this.z+"}";
	},
	
	compare : function(other){
		return this.x==other.x && this.y==other.y && this.z==other.z;
	},
	
	isValid : function(){
		return (this.x != NaN && this.x > -Infinity && this.x < Infinity) &&
			   (this.y != NaN && this.y > -Infinity && this.y < Infinity) &&
			   (this.z != NaN && this.z > -Infinity && this.z < Infinity);
	}
};

Leap.Vector.backward = function(){ return new Leap.Vector([0,0,1]); };
Leap.Vector.down = function(){ return new Leap.Vector([0,-1,0]); };
Leap.Vector.forward = function(){ return new Leap.Vector([0,0,-1]); };
Leap.Vector.left = function(){ return new Leap.Vector([-1,0,0]); };
Leap.Vector.right = function(){ return new Leap.Vector([1,0,0]); };
Leap.Vector.up = function(){ return new Leap.Vector([0,1,0]); };
Leap.Vector.xAxis = function(){ return new Leap.Vector([1,0,0]); };
Leap.Vector.yAxis = function(){ return new Leap.Vector([0,1,0]); };
Leap.Vector.zAxis = function(){ return new Leap.Vector([0,0,1]); };
Leap.Vector.zero = function(){ return new Leap.Vector([0,0,0]); };

