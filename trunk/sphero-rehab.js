var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var express = require('express');
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

var readyState = false, portSelected = false;
var angles = {pitch: 0, roll: 0, yaw: 0};
var users = [];
var tryCount = 0, maxTries = 5;

var sphero = require('sphero'), orb;

function sendReadyState(socket)
{
	var data = {ready: readyState, portSelected: portSelected, tries: tryCount, maxTries: maxTries};
	if(socket)
		socket.emit('readyState', data);
	else
		broadcast('readyState', data);
}

function broadcast(event, data, cb, timeout)
{
	var userCount = users.length;
	var trueCb = function() {};
	// Global broadcast callback (called once every client acknowledged)
	if(typeof cb === 'function')
	{
		trueCb = (function(){
			var count = 0, done = false;
			function _cb() { done = true; cb(); }
			function onTimeout()
			{
				if(done) return;
				for (var i = 0; i < users.length; i++)
					if(users[i] && !users[i].answered)
					{
						users[i].kickCount = (users[i].kickCount || 0) + 1;
						if(users[i].kickCount >= 10)
							users[i--].kick();
					}
				_cb();
			}
			if(timeout) setTimeout(onTimeout, timeout);
			for (var i = 0; i < userCount; i++)
				users[i].answered = false;
			return function(u) { u.answered = true; u.kickCount = 0; if(!done && ++count == userCount) _cb(); };
		})();
		if(!userCount) cb();
	}
	for (var i = 0; i < userCount; i++)
		users[i].emit(event, data, trueCb.bind(null, users[i]));
}

function quit()
{
	broadcast('quit');
	console.log('quitting');
	if(!orb) return process.exit();
	orb.finishCalibration(function() {
		// On met la sphero en veille
		orb.sleep(0,0,0,function(){
			orb.disconnect(function() {
				console.log('now disconnected');
				process.exit();
			});
		});
	});
}

io.on('connection', function(socket)
{
	var user = users.push(socket) - 1;
	socket.kicked = false;
	socket.kick = function() { socket.kicked = true; users.splice(user, 1); };
	socket.emit('hello');
	sendReadyState(socket);

	socket.on('close', function()
	{
		if(socket.kicked) return;
		quit();
		socket.emit('quit');
	});

	socket.on('disconnect', function()
	{
		if(socket.kicked) return;
		// Client disconnected
		users.splice(user, 1);
	});
});

router.use(express.static(path.resolve(__dirname, 'client')));
server.listen(80);

// Automatically opens the browser at localhost (can be annoying)
var open = require('open');
open('http://localhost');

var prompt = require('prompt');
prompt.start();

var serialPort = require('serialport');
serialPort.list(function (err, ports) {
	var pList = ports.map(function(port) {
		return port.comName;
	});
	console.log('Available ports : ' + pList.join(', '));
	prompt.get([{name: 'port', description: 'Select a port', message: 'Select a port in the list.', conform: function(v) { return pList.indexOf(v) != -1; }}], function(err, v) {
		if(!v || !v.port) return process.exit();
		portSelected = true;
		startServer(v.port, function() { process.exit(); });
	});
});

function startServer(port, error)
{
	var spa = require('./serialportadaptor');
	tryCount = 0, maxTries = 5;
	sendReadyState();
	spa.addErrorHandler(function() {
		console.log('Error connecting ('+(++tryCount)+'/'+maxTries+').'+(tryCount < maxTries ? ' Retrying.' : ''));
		sendReadyState();
		if(tryCount < maxTries)
			tryConnect();
		else
			error();
		//console.log('Error');
	});
	var adaptor = new spa(port);
	orb = sphero(port, {adaptor: adaptor}); /* Custom adaptor */
	
	function tryConnect()
	{
		orb.connect(orbReady);
	}
	tryConnect();
	
	function orbReady()
	{
		readyState = true;
		sendReadyState();
		
		console.log('Sphero connectée.');
		
		orb.color('#000000');
		orb.startCalibration();
		
		var send = true, received = function() { send = true; };
		orb.streamImuAngles(15);
		orb.on('imuAngles', function(data) {
			//console.log(JSON.stringify(arguments));
			//console.log(data.pitchAngle.value[0] + ' - ' + data.rollAngle.value[0] + ' - ' + data.yawAngle.value[0]);
			angles.pitch = Math.PI * data.pitchAngle.value[0] / 180;
			angles.roll = Math.PI * data.rollAngle.value[0] / 180;
			angles.yaw = Math.PI * data.yawAngle.value[0] / 180;
			if(send)
			{
				send = false;
				broadcast('angles', angles, received, 500);
			}
		});
		//setTimeout(quit, 10000);
	}
}
