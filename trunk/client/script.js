var socket = window.io ? io() : null;

var ready = false, bye = false, portSelected = false;
var tries = 0, maxTries = 5;
var angles = {pitch: 0, roll: 0, yaw: 0};
//var x = .5, y = .5;

if(socket)
{
	socket.on('hello', function() {
		console.log('hey');
	});
	
	socket.on('readyState', function(e) {
		portSelected = e.portSelected;
		ready = e.ready;
		tries = e.tries;
		maxTries = e.maxTries;
	});
	
	socket.on('angles', function(e, fn) {
		//console.log(e);
		//angles = e.map(function(e){ return Math.PI * e / 180; });
		angles = e;
		fn(); // Acknowledgement
	});
	
	socket.on('quit', function() {
		console.log('bye');
		socket.disconnect();
	});
	
	socket.on('disconnect', function() {
		bye = true;
		socket = null;
	});
}

//setTimeout(function() { if(socket) socket.emit('close'); }, 5000);
/*document.addEventListener('keydown', function(e)
{
	if(e.keyCode == 32 && socket)
		socket.emit('close');
});*/

var c = document.getElementById('c'),
	ctx = c.getContext('2d');

var hitboxC = document.createElement('canvas'),
	hbCtx = hitboxC.getContext('2d');

var w = 1000, h = 1000;
hitboxC.width = w; hitboxC.height = h;

var resourcesSrc = {
	map1: {type: 'image', src: 'img/map1.png'},
	map1hb: {type: 'image', src: 'img/map1hb.png'},
	map2bg: {type: 'image', src: 'img/map2bg.jpg'},
	pbg1: {type: 'image', src: 'img/pbg1.png'},
	pbg2: {type: 'image', src: 'img/pbg2.png'},
	pbg3: {type: 'image', src: 'img/pbg3.png'},
	pbg4: {type: 'image', src: 'img/pbg4.png'},
	pbg5: {type: 'image', src: 'img/pbg5.png'}
};
var res;

function load(list, callback, progress) {
	var count = 0, total = 0, results = {};
	function update(){ if(typeof progress == 'function') progress(count / total); if(count == total) callback(results); }
	function add(name, r) { if(!results[name]) count++; results[name] = r; update(); }
	var loaders = {
		image: function(src, name) {
			var i = new Image();
			i.onload = add.bind(null, name, i);
			i.crossOrigin = 'Anonymous';
			i.src = src;
		}
	};
	for(var e in list)
	{
		var r = list[e]; total++;
		(loaders[r.type] || nothing)(r.src, e);
	}
}

var kbd = [];
document.addEventListener('keydown', function(e) { kbd[e.keyCode] = true; });
document.addEventListener('keyup', function(e) { kbd[e.keyCode] = false; });

function nothing() {}

function comeCloser(n, goal, factor, limit)
{
	return (limit && Math.abs(goal - n) < limit) ? goal : n + (goal - n) / (factor || 10);
}

function clamp(n,m,M) { return n<M?n>m?n:m:M; }

function drawRepeatXImg(ctx, img, x, y, w, h, cw)
{
	while(x >= 0) x -= w;
	while(x < cw)
	{
		ctx.drawImage(img, x, y, w, h);
		x += w;
	}
}

/*var playerImd = (function() {
	var c = document.createElement('canvas'),
		ctx = c.getContext('2d');
	c.width = 8; c.height = 8;
	ctx.fillRect(0,0,c.width,c.height);
	return ctx.getImageData(0,0,c.width,c.height);
})();*/

var defaultPlayerCheckBasic = function(centerX, centerY, width, height)
{
	return function(ctx) {
		var d = ctx.getImageData(this.x - centerX, this.y - centerY, width, height).data;
		for(var i = 3, l = d.length; i < l; i += 4)
			if(d[i] > 127) return true;
		return false;
	};
};
var defaultPlayerCheck = function(pImd, centerX, centerY)
{
	return function(ctx) {
		var d = ctx.getImageData(this.x - centerX, this.y - centerY, pImd.width, pImd.height).data;
		for(var i = 3, l = d.length; i < l; i += 4)
			if(pImd.data[i] > 127 && d[i] > 127) return true;
		return false;
	};
};
var defaultPlayer = {
	fx: .5, fy: .5,
	x: 0, y: 0,
	draw: function(ctx) {
		ctx.fillRect(this.x - 3, this.y - 3, 6, 6);
	},
	getDesiredPos: function() {
		return {x: (3 * angles.roll / Math.PI) * .5 + .5, y: (3 * angles.pitch / Math.PI) * .5 + .5};
	},
	move: function(dt) {
		/*if(kbd[37]) this.x -= this.speed;
		if(kbd[38]) this.y -= this.speed;
		if(kbd[39]) this.x += this.speed;
		if(kbd[40]) this.y += this.speed;*/
		var goal = this.getDesiredPos();
		this.fx = clamp(comeCloser(this.fx, goal.x, 5), 0, 1);
		this.fy = clamp(comeCloser(this.fy, goal.y, 5), 0, 1);
		this.x = this.fx * w;
		this.y = this.fy * h;
	},
	check: defaultPlayerCheckBasic(3, 3, 6, 6)
};

var maps = [];
// -- menu --
maps.push(
	{
		readKeyDown: function(key) {
			var returnValue = !this.kbd[key] && kbd[key];
			this.kbd[key] = kbd[key];
			return returnValue;
		},
		vMargin: 50,
		font: '24px "Century Gothic",CenturyGothic,AppleGothic,sans-serif',
		selected: 0,
		cursorY: 0,
		init: function() {
			this.kbd = [];
			this.options = [];
			for(var i = 1; i < maps.length; i++)
				this.options.push({text: maps[i].name, action: startMap.bind(null, i)});
			this.options.push({text: 'Quit', action: function(){ if(socket) socket.emit('close'); }});
			this.vcY = 0;
			this.menuY = (h - (this.options.length - 1) * this.vMargin) / 2;
			// Should measure longest option here to center
			this.menuX = (w - 100) / 2;
		},
		end: nothing,
		update: function(t, dt) {
			if(kbd[32] || kbd[13]) // Space or enter
				this.options[this.selected].action();//startMap(this.selected);
			if(this.readKeyDown(38))
			{
				this.selected--;
				if(this.selected < 0)
					this.selected = this.options.length - 1;
			}
			if(this.readKeyDown(40))
			{
				this.selected++;
				if(this.selected >= this.options.length)
					this.selected = 0;
			}
			var goal = this.selected * this.vMargin;
			this.vcY = (this.vcY + (goal - this.cursorY) * .1) * .8;
			this.cursorY += this.vcY;
		},
		draw: function(ctx) {
			ctx.fillStyle = 'black';
			ctx.fillRect(0,0,w,h);
			ctx.fillStyle = 'white';
			ctx.font = this.font;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			var x = this.menuX, y = this.menuY;
			for(var i = 0, l = this.options.length; i < l; i++)
			{
				ctx.fillText(this.options[i].text, x, y + i * this.vMargin);
			}
			ctx.beginPath();
			for(var i = 0; i < 3; i++)
			{
				var a = i * Math.PI * 2 / 3, r = 7;
				ctx.lineTo(x - 20 + r * Math.cos(a), y + this.cursorY + r * Math.sin(a));
			}
			ctx.fill();
		},
		check: nothing
	}
);

// -- 1 --
maps.push(
	{
		name: "Labyrinth",
		player: defaultPlayer,
		resetPlayer: function() { this.player.fx = .5; this.player.fy = .5; this.player.x = this.player.fx * w; this.player.y = this.player.fy * h; },
		init: function() { this.resetPlayer(); this.lostTimer = 3; this.deadPos = {x: .5, y: .5}; },
		end: nothing,
		goal: {x: 100, y: 100, rad2: 2500},
		onwin: function() { this.player.win = true; },
		onlose: function() { this.deadPos.x = this.player.fx; this.deadPos.y = this.player.fy; this.resetPlayer(); this.lostTimer = 3; },
		update: function(t, dt) {
			if(this.lostTimer > 0)
			{
				this.lostTimer -= dt;
				if(this.lostTimer < 0) this.lostTimer = 0;
				return;
			}
			this.player.move();
			var dx = this.player.x - this.goal.x, dy = this.player.y - this.goal.y;
			if(dx*dx + dy*dy < this.goal.rad2)
				this.onwin();
		},
		draw: function(ctx) {
			ctx.clearRect(0,0,w,h);
			ctx.drawImage(res.map1, 0, 0);
			ctx.fillStyle = this.player.win ? 'green' : this.player.hit ? 'red' : 'black';
			this.player.draw(ctx);
			if(this.lostTimer > 0)
			{
				ctx.font = '50px "Arial Black","Arial Bold",Gadget,sans-serif';
				ctx.fillStyle = 'white';
				ctx.strokeStyle = 'black';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.lineWidth = 2.5;
				ctx.fillText('GO BACK TO REST', 500, 450);
				ctx.strokeText('GO BACK TO REST', 500, 450);
				ctx.save();
				ctx.translate(500, 550);
				var scale = 1 + (this.lostTimer % 1) * 2.5;
				ctx.scale(scale, scale);
				var txt = ~~this.lostTimer + 1;
				ctx.fillText(txt, 0, 0);
				ctx.strokeText(txt, 0, 0);
				ctx.restore();
				ctx.fillStyle = 'red';
				var pos = this.player.getDesiredPos();
				this.deadPos.x = clamp(comeCloser(this.deadPos.x, pos.x, 5), 0, 1);
				this.deadPos.y = clamp(comeCloser(this.deadPos.y, pos.y, 5), 0, 1);
				ctx.fillRect(w * this.deadPos.x - 3, h * this.deadPos.y - 3, 6, 6);
			}
		},
		check: function(ctx) {
			ctx.clearRect(0,0,w,h);
			ctx.drawImage(res.map1hb, 0, 0);
			if(this.player.check(ctx))
				this.onlose();//this.player.hit = true;//this.onlose();
			//else
			//	this.player.hit = false;
		},
		
	}
);

// -- 2 --
maps.push(
	{
		name: "Fly Away",
		objects: [],
		player: {
			x: 80,
			fy: .5, y: 0,
			size: 12,
			draw: function(ctx) {
				ctx.fillRect(this.x - this.size * .5, this.y - this.size * .5, this.size, this.size);
			},
			check: function(ctx) {
				var d = ctx.getImageData(this.x - this.size * .5, this.y - this.size * .5, this.size, this.size).data;
				for(var i = 3, l = d.length; i < l; i += 4)
					if(d[i] > 127) return true;
				return false;
			},
			move: function() {
				var yGoal = (3 * angles.pitch / Math.PI) * .5 + .5;
				/*var yGoal = this.fy;
				if(kbd[38]) yGoal -= .04;
				if(kbd[40]) yGoal += .04;*/
				this.fy = clamp(comeCloser(this.fy, yGoal, 5), 0, 1);
				this.y = this.fy * h;
			},
			dead: false,
			particles: []
		},
		ondeath: function() {
			var p = this.player, px = p.x - p.size * .5, py = p.y - p.size * .5;
			p.dead = true;
			for(var x = 0; x < p.size; x++)
				for(var y = 0; y < p.size; y++)
				{
					var angle = Math.random() * Math.PI * 2, force = (Math.random() + .05) * 200;
					p.particles.push({x: px + x, y: py + y, vx: force * Math.cos(angle) + .5 * this.currentSpeed, vy: force * Math.sin(angle)});
				}
		},
		createObject: function(x, speed, holeSize) {
			return {x: x, size: 30, speed: speed, hole: Math.random() * (h - holeSize), holeSize: holeSize};
		},
		drawObject: function(ctx, o) {
			ctx.fillStyle = 'black';
			ctx.fillRect(o.x, 0, o.size, o.hole);
			var hb = o.hole + o.holeSize;
			ctx.fillRect(o.x, hb, o.size, h - hb);
		},
		init: function() {
			this.score = 0;
			this.player.dead = false;
			this.player.particles = [];
			this.counter = 0; this.next = 110;
			this.currentSpeed = 350; this.currentSize = 275;
			this.bgpos = 0;
			this.objects = [];
		},
		end: nothing,
		update: function(t, dt) {
			if(this.player.dead)
			{
				var p = this.player.particles;
				for(var i = 0, l = p.length; i < l; i++)
				{
					p[i].vy += 200 * dt;
					p[i].vy *= Math.pow(.98, dt);
					p[i].x += p[i].vx * dt;
					p[i].y += p[i].vy * dt;
					if(p[i].y > h)
					{
						p.splice(i--, 1);
						l--;
					}
				}
				return;
			}
			this.player.move();
			this.bgpos += 60 * dt;
			//this.currentSpeed += 0.0001;
			this.score += 60 * dt;
			for(var i = this.objects.length; i--; )
			{
				this.objects[i].x -= this.objects[i].speed * dt;
				if(this.objects[i].x < -this.objects[i].size)
					this.objects.splice(i, 1);
			}
			if(this.counter++ >= this.next)
			{
				this.counter = 0;
				this.objects.push(this.createObject(w, (1 + .2 * Math.random()) * this.currentSpeed, this.currentSize));
				if(this.currentSpeed < 750) this.currentSpeed += 4;
				if(this.currentSize > 40) this.currentSize -= 1.3;
				if(this.next > 50) this.next -= 1.2;
			}
		},
		draw: function(ctx) {
			var bgFac = h / res.pbg1.height, bgWidth = res.pbg1.width * bgFac;
			ctx.drawImage(res.pbg1, (w - bgWidth) * .5, 0, bgWidth, h);
			drawRepeatXImg(ctx, res.pbg2, -this.bgpos * 0.5, h - res.pbg2.height * bgFac, res.pbg2.width * bgFac, res.pbg2.height * bgFac, w);
			drawRepeatXImg(ctx, res.pbg3, -this.bgpos * 1.0, h - res.pbg3.height * bgFac, res.pbg3.width * bgFac, res.pbg3.height * bgFac, w);
			drawRepeatXImg(ctx, res.pbg4, -this.bgpos * 1.5, h - res.pbg4.height * bgFac, res.pbg4.width * bgFac, res.pbg4.height * bgFac, w);
			drawRepeatXImg(ctx, res.pbg5, -this.bgpos * 2.0, h - res.pbg5.height * bgFac, res.pbg5.width * bgFac, res.pbg5.height * bgFac, w);
			for(var i = this.objects.length; i--; )
				this.drawObject(ctx, this.objects[i]);
			if(this.player.dead)
			{
				var p = this.player.particles;
				ctx.fillStyle = 'blue';
				for(var i = 0, l = p.length; i < l; i++)
				{
					ctx.fillRect(p[i].x, p[i].y, 1, 1);
				}
			}
			else
			{
				ctx.fillStyle = this.player.colliding ? 'red' : 'blue';
				this.player.draw(ctx);
			}
			ctx.fillStyle = 'white';
			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';
			ctx.font = '20px monospace';
			ctx.fillText(~~this.score, 10,10);
		},
		check: function(ctx) {
			if(this.player.dead) return;
			ctx.clearRect(0,0,w,h);
			for(var i = this.objects.length; i--; )
				this.drawObject(ctx, this.objects[i]);
			if(this.player.check(ctx))
				this.ondeath();
			/*{
				this.player.death++;
				this.player.colliding = true;
			}
			else
				this.player.colliding = false;*/
		}
	}
);

function rotateX(p, a) {
	var d = Math.sqrt(p[1] * p[1] + p[2] * p[2]),
		na = Math.atan2(p[1], p[2]) + a;
	return [p[0], d * Math.sin(na), d * Math.cos(na)];
}
function rotateY(p, a) {
	var d = Math.sqrt(p[2] * p[2] + p[0] * p[0]),
		na = Math.atan2(p[2], p[0]) + a;
	return [d * Math.cos(na), p[1], d * Math.sin(na)];
}
function rotateZ(p, a) {
	var d = Math.sqrt(p[0] * p[0] + p[1] * p[1]),
		na = Math.atan2(p[1], p[0]) + a;
	return [d * Math.cos(na), d * Math.sin(na), p[2]];
}
function closestAngle(oldAngle, newAngle)
{
	var tmp, tmpDist, dist = Math.abs(newAngle - oldAngle);
	while((tmpDist = Math.abs((tmp = newAngle + 2 * Math.PI) - oldAngle)) < dist)
	{
		newAngle = tmp;
		dist = tmpDist;
	}
	while((tmpDist = Math.abs((tmp = newAngle - 2 * Math.PI) - oldAngle)) < dist)
	{
		newAngle = tmp;
		dist = tmpDist;
	}
	return newAngle;
}
// -- 3 --
maps.push(
	{
		name: 'Sphere',
		projection: function(p) {
			// Flat
			return [p[0] * this.r, p[1] * this.r, p[2]];
		},
		getAlpha: function(p) {
			return clamp(p[2] + 1.3, 0, 1);
		},
		getSize: function(r, p) {
			return r * (.3 + (p[2] + 1) / 2);
		},
		checkGoal: function() {
			var c = this.rpoints[this.colored], g = this.goal;
			var dx = c[0] - g[0], dy = c[1] - g[1], dz = c[2] - g[2];
			var gR = (this.goalRad - this.dotRad) / this.r;
			//console.log(dx * dx + dy * dy + dz * dz);
			return dx * dx + dy * dy + dz * dz <= gR * gR;
		},
		generateGoal: function() {
			this.goal = (function(){
				var x = Math.random() - .5, y = Math.random() - .5, z = Math.random();
				var n = Math.sqrt(x*x+y*y+z*z);
				if(n == 0) return [1,0,0];
				return [x/n, y/n, z/n];
			})();
			this.pgoal = this.projection(this.goal);
			this.goalSize = this.getSize(this.goalRad, this.pgoal[2]);
		},
		init: function() {
			this.yawDelta = angles.yaw;
			this.r = 300;
			this.proj = [];
			this.n = 64;
			this.colored = ~~(Math.random() * this.n);
			this.angles = [0,0,0];
			this.points = (function(n) {
				var p = [];
				var dL = Math.PI * (3 - Math.sqrt(5)), dz = 2 / n,
					lon = 0, z = 1 - dz * .5;
				for(var i = 0; i < n; i++)
				{
					var r = Math.sqrt(1 - z*z);
					p.push([r * Math.cos(lon), r * Math.sin(lon), z, ~~(Math.random() * 7)]);
					z -= dz; lon += dL;
				}
				return p;
			})(this.n);
			this.rpoints = [];
			this.dotRad = 10;
			this.goalRad = 20;
			this.generateGoal();
			this.win = 0;
		},
		end: nothing,
		update: function(t, dt) {
			this.rpoints = [];
			this.proj = [];
			var goals = [
				closestAngle(this.angles[0], angles.pitch),
				closestAngle(this.angles[1], this.yawDelta - angles.yaw),
				closestAngle(this.angles[2], angles.roll)];
			var x = this.angles[0] = comeCloser(this.angles[0], goals[0], 5);
			var y = this.angles[1] = comeCloser(this.angles[1], goals[1], 5);
			var z = this.angles[2] = comeCloser(this.angles[2], goals[2], 5);
			for(var i = 0; i < this.n; i++)
			{
				var p = rotateY(rotateX(rotateZ(this.points[i], z), x), y);
				//var p = rotateY(rotateX(this.points[i], -y), -x);
				//var p = this.points[i];
				this.rpoints.push(p);
				this.proj.push(this.projection(p));
			}
			if(this.win > 0)
				this.win = Math.max(0, this.win - dt * 2);
			if(this.checkGoal())
			{
				//console.log('GOAL');
				this.win = 1;
				this.generateGoal();
			}
		},
		draw: function(ctx) {
			ctx.clearRect(0,0,w,h);
			ctx.fillStyle = 'rgba(120,255,150,'+(this.win * .5)+')';
			ctx.fillRect(0,0,w,h);
			for(var i = 0; i < this.n; i++)
			{
				var p = this.proj[i];
				var alpha = this.getAlpha(p), size = this.getSize(this.dotRad, p);
				var r = i == this.colored ? 255 : 0;
				ctx.fillStyle = 'rgba('+r+',0,0,'+alpha+')';
				 //ctx.fillRect(500 + p[0] - size * .5, 500 + p[1] - size * .5, size, size);
				ctx.beginPath();
				ctx.arc(w * .5 + p[0], h * .5 + p[1], size, 0, 2 * Math.PI);
				ctx.fill();
			}
			ctx.strokeStyle = 'red';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(w * .5 + this.pgoal[0], w * .5 + this.pgoal[1], this.goalRad, 0, 2 * Math.PI);
			ctx.stroke();
		},
		check: nothing
	}
);

var map;
function startMap(m)
{
	if(map) map.end();
	if(typeof m === 'number') m = maps[m];
	m.init();
	map = m;
}
startMap(0);

function resize()
{
	c.width = c.offsetWidth;
	c.height = c.offsetHeight;
	ctx.fillStyle = 'black';
	ctx.fillRect(0,0,c.width,c.height);
	var s = Math.min(c.width / w, c.height / h);
	ctx.translate(c.width / 2 - s * w / 2, c.height / 2 - s * h / 2);
	ctx.scale(s, s);
	ctx.beginPath();
	ctx.rect(0,0,w,h);
	ctx.clip();
}
window.addEventListener('resize', resize);
resize();

var prevT, resProgress = 0;
function update(t)
{
	requestAnimationFrame(update);
	if(bye)
	{
		ctx.fillStyle = 'black';
		ctx.fillRect(0,0,w,h);
		ctx.fillStyle = 'white';
		ctx.font = '30px Consolas,monaco,monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Bye', w/2, h/2);
		return;
	}
	t *= .001;
	var dt = (prevT ? t - prevT : 0);
	prevT = t;
	if(!ready || !res)
	{
		ctx.fillStyle = 'black';
		ctx.fillRect(0,0,w,h);
		ctx.fillStyle = 'white';
		ctx.save();
		ctx.translate(w / 2, h / 2);
		ctx.textAlign = 'center';
		ctx.font = '20px Consolas,monaco,monospace';
		var nbDots = ~~(t * 1.2) % 3 + 1;
		var spheroText = ready ? 'Sphero ready' : !portSelected ? 'Select a serial port' : 'Try ' + tries + ' / ' + maxTries;
		ctx.fillText(spheroText + ' ' + (new Array(nbDots + 1).join('.')+'  ').slice(0,3), 0, 60);
		t *= 3;
		ctx.rotate((t + (Math.sin(t) * 1.5)) * 2);
		ctx.fillRect(-20,-20,40,40);
		ctx.restore();
		return;
	}
	if(kbd[27] && map != maps[0]) startMap(0);
	var oldmap = map;
	map.update(t, dt);
	if(map != oldmap) return; // We changed map, wait for update
	map.draw(ctx);
	map.check(hbCtx);
}

function resourcesLoaded(r)
{
	res = r;
}
function resourcesProgress(p) { resProgress = p; }
load(resourcesSrc, resourcesLoaded, resourcesProgress);
requestAnimationFrame(update);
