// Reference: http://mathworld.wolfram.com/Line-PlaneIntersection.html
// A plane is described by 3 points on the plane (point1, point2, point3)

// Plane(vector point1, vector point2, vector point3)
var Plane = function(point1, point2, point3){
	
	this.point1 = new Leap.Vector(point1);
	this.point2 = new Leap.Vector(point2);
	this.point3 = new Leap.Vector(point3);
};

Plane.prototype.fromNormal = function(point1, normal){
	
	var ortho1 = new Leap.Vector();
	
	if(normal.z==0){
		if(normal.x==0 && normal.y==0) return null;
		
		ortho1.x = normal.y;
		ortho1.y = -normal.x;
	}
	else{
		ortho1.x = normal.z;
		ortho1.y = normal.z;
		ortho.z = (normal.x + normal.y);
	}
	
	var ortho2 = normal.cross(ortho1);
	
	var plane = new Plane(point1, point1.plus(ortho1), point1.plus(ortho2));
	plane._normal = new Leap.Vector(normal);
	plane.normal = function(){ return this._normal; };
	
	return plane;
};

// vector normal()
Plane.prototype.normal = function(){
	
	var x21 = this.point2.x - this.point1.x;
	var y21 = this.point2.y - this.point1.y;
	var z21 = this.point2.z - this.point1.z;
	
	var x31 = this.point3.x - this.point1.x;
	var y31 = this.point3.y - this.point1.y;
	var z31 = this.point3.z - this.point1.z;
	
	var x = y21*z31 - y31*z21;
	var y = x21*z31 - x31*z21;
	var z = x21*y31 - x31*y21;
    
    if(x==0 && y==0 && z==0) this._normal = null;
	else this._normal = new Leap.Vector([x, y, z]);
	
	this.normal = function(){ return this._normal; };
	return this._normal;
};

// vector unitnormal()
Plane.prototype.unitnormal = function(){
    
    var n = this.normal();
    if(n==null) return null;
    
	this._unitnormal = n.normalized();
	
	this.unitnormal = function(){ return this._unitnormal; };
	return this._unitnormal;
};

// { position: vector, distance: float } pointIntersect( vector point )
Plane.prototype.pointIntersect = function(point){
	
    var u = this.unitnormal();
    var d = u.dot(this.point1.minus(point));
    var p = u.multiply(d).plus(point);
    
    return {position: p, distance: d};
	
};

// { position: vector, distance: float } rayIntersect( vector rayPosition, vector rayDirection )
Plane.prototype.rayIntersect = function(rayPosition, rayDirection){
	
	var d = rayDirection.dot(this.normal());
	
	if(d == 0) return null;
	
	var n = this.point1.minus(rayPosition).dot(this.normal());
	var t =  n/d;
	
	//if(t < 0) return null;
	
	var intersect = rayPosition.plus(rayDirection.multiply(t));
	var distance = t*rayDirection.magnitude();
	
	return {position: intersect, distance: distance};
};
