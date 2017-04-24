// set up forked web audio context, for multiple browsers window.
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var source, stream, buffer, analyser, analyser_two, fileSource, rootNote, htmlRGB, vol, color, length, time, canvas_one, canvas_two, canvas_three, visCtx_one, visCtx_two, visCtx_three, octaveMod, buflen;
var starttime = 0;
//var volume_size = 50;
var volume_size = 35;
var canvasIndex = 0;
var frequencyReferences = [27.50, 29.14, 30.87, 32.7, 34.65, 36.71, 38.89, 41.2, 43.65, 46.25, 49, 51.91];
var height = 1500;
var width = $(window).width() / 2;
var octaveHeight = 120;
var skipCount = 0;
var tutorial = ["#context", "#position", "#height", "#size", "#color"];
var tutorialCount = 0;
var started = false;




/////////////////////////
//      FUNCTIONS      //
/////////////////////////

// set up canvas
function newCanvas() {
	canvas_two = document.createElement('canvas');
	visCtx_two = canvas_two.getContext("2d");
	canvas_two.height = height;
	canvas_two.width = width;
	visCtx_two.globalAlpha = 0.1;
	$( '#container' ).append(canvas_two);
}





//set up the audio nodes
function setupAudioNodes() {
	analyser = audioCtx.createAnalyser();
	analyser.minDecibels = -100;
	analyser.maxDecibels = -30;
	analyser.smoothingTimeConstant = 0.85;
	analyser.fftSize = 1024;
	
	analyser_two = audioCtx.createAnalyser();
	analyser_two.minDecibels = -100;
	analyser_two.maxDecibels = -30;
	analyser_two.smoothingTimeConstant = 0;
	analyser_two.fftSize = 1024 / 2 / 2;
}





// upload file
function uploadAudio(url) {
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';
	request.onprogress = function() {
		setupAudioNodes();
	};
	request.onload = function() {
	audioCtx.decodeAudioData(request.response, function(buffer) {
		source = audioCtx.createBufferSource();
		source.buffer = buffer;
		source.connect(analyser);
		analyser.connect(audioCtx.destination);
		source.loop = false;
		clearInterval(loading);
		$('#loading').hide();
		source.start();
		starttime = audioCtx.currentTime;
		length = starttime + buffer.duration;
		visualize();
	});
	}
	request.send();
}





// visualizer
function visualize() {
	var bufferLength = analyser.frequencyBinCount;
	var dataArray = new Uint8Array(bufferLength);
	
	var bufferLength_two = analyser_two.frequencyBinCount;
	var dataArray_two = new Uint8Array(bufferLength_two);

	function draw() {
		time = audioCtx.currentTime * 100;
		
		if (time/100 > length && fileSource) {
			audioCtx = null; // complete
			$('#end').fadeIn(500);
//			resetCanvas();
//			resetCanvas();
		}		
		drawVisual = requestAnimationFrame(draw);
		analyser.getByteFrequencyData(dataArray);
		analyser_two.getByteFrequencyData(dataArray_two);
		if(skipCount % 3 == 0) {
			for (var i = 0; i < bufferLength; i += 100) {
				$( '#time' ).html(time / 100);			
				if (dataArray[i] != 0) {
					// calculate volume
					volume = getVolume(dataArray);
					$( '#vol' ).html(volume);

					// calculate pitch
					analyser.getFloatTimeDomainData( buf );
					var pitch = autoCorrelate(buf, audioCtx.sampleRate);
					
					// calculate pitch on second FFT if first is 0
					if (pitch <= 0) {
						analyser_two.getFloatTimeDomainData( buf );
						var pitch = autoCorrelate(buf, audioCtx.sampleRate);
					}

					if (!fileSource && pitch > 0) pitch = pitch / 4;
					if (pitch > 0) {
						$( '#pitch' ).html(Math.ceil(pitch) + "Hz");
						toRGB(translateFrequency(pitch)); // calculate color
						drawNote(time - (starttime * 100) + 100, pitch/1, color, volume * 2 * volume_size / 50);
					}
				}
			}
		}
		skipCount++;
	};
	draw();
}





// auto correlator (returns pitch)
buflen = 1024;
var buf = new Float32Array( buflen );
var MIN_SAMPLES = 0;
var GOOD_ENOUGH_CORRELATION = 0.9;
function autoCorrelate(buf, sampleRate) {
	var SIZE = buf.length;
	var MAX_SAMPLES = Math.floor(SIZE/2);
	var best_offset = -1;
	var best_correlation = 0;
	var rms = 0;
	var foundGoodCorrelation = false;
	var correlations = new Array(MAX_SAMPLES);
	
	var arrray =  new Uint8Array(analyser.frequencyBinCount);
	analyser.getByteFrequencyData(arrray);
	
	for (var i=0; i<SIZE; i++) {
		var val = buf[i];
		rms += val*val;
	}
	
	rms = Math.sqrt(rms/SIZE);
	
	if (rms<0.01) return -1;
	
	var lastCorrelation = 1;
	for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
		var correlation = 0;

		for (var i=0; i<MAX_SAMPLES; i++) {
			correlation += Math.abs((buf[i])-(buf[i+offset]));
		}
		correlation = 1 - (correlation/MAX_SAMPLES);
		correlations[offset] = correlation;
		if ((correlation>GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
			foundGoodCorrelation = true;
			if (correlation > best_correlation) {
				best_correlation = correlation;
				best_offset = offset;
			}
		} else if (foundGoodCorrelation) {
			var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];  
			return sampleRate/(best_offset+(8*shift));
		}
		lastCorrelation = correlation;
	}
	if (best_correlation > 0.01) {
		return sampleRate/best_offset;
	}
	return -1;	
}





// wavelength to color
// returns rgb color of the wavelength
function toRGB(wavelength) {
	var rgb;
	var gamma = 0.8;
	if (wavelength >= 380 && wavelength <= 440) {
			attenuation = 0.3 + 0.7 * (wavelength - 380) / (440 - 380);
			R = ((-(wavelength - 440) / (440 - 380)) * attenuation) ** gamma;
			G = 0.0;
			B = (1.0 * attenuation) ** gamma;
	} else if (wavelength >= 440 && wavelength <= 490) {
			R = 0.0;
			G = ((wavelength - 440) / (490 - 440)) ** gamma;
			B = 1.0;
	} else if (wavelength >= 490 && wavelength <= 510) {
			R = 0.0;
			G = 1.0;
			B = (-(wavelength - 510) / (510 - 490)) ** gamma;
	} else if (wavelength >= 510 && wavelength <= 580) {
			R = ((wavelength - 510) / (580 - 510)) ** gamma;
			G = 1.0;
			B = 0.0;
	} else if (wavelength >= 580 && wavelength <= 645) {
			R = 1.0;
			G = (-(wavelength - 645) / (645 - 580)) ** gamma;
			B = 0.0;
	} else if (wavelength >= 645 && wavelength <= 750) {
			attenuation = 0.3 + 0.7 * (750 - wavelength) / (750 - 645);
			R = (1.0 * attenuation) ** gamma;
			G = 0.0;
			B = 0.0;
	} else {
			R = 0.0;
			G = 0.0;
			B = 0.0;
	}
	R *= 255;
	G *= 255;
	B *= 255;
	color = rgbToHex(parseInt(R), parseInt(G), parseInt(B));
	rgb = [parseInt(R), parseInt(G), parseInt(B)];
	htmlRGB = "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", .25)";
	return htmlRGB;
}






// scales to rootNote
// returns scaled frequency between A0 and G0
function scaleNote(frequency) {
	var result = parseFloat(frequency);
	octaveMod = 0;
	while(result > rootNote*2){
		result *= .5;
		octaveMod++;
	}
	
	while (result < 27.5) {
		result *= 2;
	}
	return result;
}





// calculate pitch height
function calculateY(frequency) {
	var result = 0;
	while(frequency >= 32.70){
		frequency *= .5;
		result += octaveHeight;
	}
	
//	if ( frequency == 32.70 ) {
//		result += octaveHeight;
//		frequency = 0;
//	}
	var extra = ((frequency - 16.35) / 16.35) * octaveHeight;
	return result + extra;
}






// set rootNode
function setRootNode(index) {
	rootNote = frequencyReferences[index];
	drawColorDemo();
}






// calculate wavelength of color from frequency
function translateFrequency(frequency) {
	frequency = scaleNote(frequency);
	frequency -= rootNote;
	return 380 + ((370 / rootNote) * frequency);
}





// calculate volume
function getVolume(array) {
	var values = 0;
	for (var i = 0; i < array.length; i++) {
		values += array[i];
	};
	return values / array.length;
}





// rgb to hex
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}





// draw circle
function drawNote(x, pitch, color, size) {
	// calculate pitch position
	var y = calculateY(pitch);
	y = height - y;
	
	x = x - canvasIndex;
	visCtx_one.beginPath();
	visCtx_one.arc(x, y, size, 0, 2 * Math.PI, false);
	visCtx_one.fillStyle = color;
	visCtx_one.fill();
	visCtx_one.closePath();
	
	// draw residue on second canvas
	if (x + size > width) {
		visCtx_two.beginPath();
		visCtx_two.arc(x - width, y, size, 0, 2 * Math.PI, false);
		visCtx_two.fillStyle = color;
		visCtx_two.fill();
	visCtx_one.closePath();
	}
	
	// draw residue on first canvas
	if (x - size < 0) {
		visCtx_one.beginPath();
		visCtx_one.arc(x, y, size, 0, 2 * Math.PI, false);
		visCtx_one.fillStyle = color;
		visCtx_one.fill();
	visCtx_one.closePath();		
	}
	
	// reset canvas
	
	if (x > width * 1.5) {
		resetCanvas();
		canvasIndex += width;	
	}
}





// resize canvas
function resetCanvas() {
	// download
//	var a = document.createElement('a');
//	a.href = canvas_one.toDataURL("image/png").replace("image/png", "image/octet-stream");
//	a.download = "ravel.png";
//	a.click();
	
	// make new canvas
	canvas_one = canvas_two;
	visCtx_one = visCtx_two;
	canvas_two = null;
	newCanvas();
	
	// animate old canvas
	$("#container").animate({"left" : -width}, width * 10, "linear", function(){
		$("canvas:first-of-type").remove();
		$("#container").css("left", "0");
	})
}





// disable next and prev buttons
function disableButtons() {
	if (tutorialCount == 0) {
		$('#prev').css('opacity', '.5');
		$('#next').css('opacity', '1');
	} else if(tutorialCount == tutorial.length - 1) {
		$('#next').css('opacity', '.5');
		$('#prev').css('opacity', '1');
	} else {
		$('#prev').css('opacity', '1')
		$('#next').css('opacity', '1')
	}
}

// draw color demo
function drawColorDemo() {
	var temp = '<div class="circle" style="background-color: ' + toRGB(translateFrequency(27.50*4)) + '">A</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(29.14*4)) + '">A&#9837; / B&#9839;</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(30.87*4)) + '">B</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(16.35*4)) + '; border: 2px solid #808080">C</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(17.32*4)) + '">C&#9837; / D&#9839;</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(18.35*4)) + '">D</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(19.45*4)) + '">D&#9837; / E&#9839;</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(20.60*4)) + '">E</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(21.83*4)) + '">F</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(23.12*4)) + '">F&#9837; / G&#9839;</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(24.50*4)) + '">G</div>';
	temp += '<div class="circle" style="background-color: ' + toRGB(translateFrequency(25.96*4)) + '">G&#9837; / A&#9839;</div>';
	$('.colorsetting').html(
		temp
	)
}





// demo scroll
function scrollNeed() {
	$('.block').each(function(){
		if ($(this).height() > $('.popup').height()) {
			$('.block').css('height', $('.popup').height());
			$('.block').css('overflow-x', 'hidden');
			$('.block').css('overflow-y', 'auto');
		}
	})
}





//////////////////////////
//         MAIN         //
//////////////////////////






// user choice of microphone
$( '#mic' ).click(function(){
	fileSource = false;	
	// getUserMedia for multiple browser versions, for those that need prefixes
	var navCheck = (navigator.getUserMedia ||
							  navigator.webkitGetUserMedia ||
							  navigator.mozGetUserMedia ||
							  navigator.msGetUserMedia);
	
	// live audio feed
	if (navCheck) {
		console.log('getUserMedia supported.');
		setupAudioNodes();
		navigator.getUserMedia ({
				audio: true, video: false
			},
			function(stream) { // Successful callback
				source = audioCtx.createMediaStreamSource(stream);
				source.connect(analyser);
				starttime = audioCtx.currentTime;
				visualize();
			},
			function(err) { // Error on callback
				console.log('The following gUM error occured: ' + err);
			});
	} else {
			console.log('getUserMedia not supported on your browser!');
	}
	
	$('#tutorialnavigation').fadeOut(500);
	$('.popup').fadeOut(500);
	$('#skip').fadeOut(500);
	started = true;
	$('#skip').attr('href', '#');
	$('#close').attr('href', '#');
	$('#icons span').css('max-width', 0);
});





// user choice of uploading file

$('#uploadSelect').click(function(){
	$('#upload').click();
})

$( document ).on('change', '#upload', function(){
	var file = URL.createObjectURL(this.files[0]);
	fileSource = true;
	$('#loading').fadeIn(500);
	uploadAudio(file);
	$('#tutorialnavigation').fadeOut(500);
	$('.popup').fadeOut(500);
	$('#skip').fadeOut(500);
	started = true;
	$('#skip').attr('href', '#');
	$('#close').attr('href', '#');
	$('#icons span').css('max-width', 0);
})

// user choice of demo
function playSample(file){
	$('#loading').fadeIn(500);
	fileSource = true;
	uploadAudio(file);
	$('#tutorialnavigation').fadeOut(500);
	$('.popup').fadeOut(500);
	$('#skip').fadeOut(500);
	started = true;
	$('#skip').attr('href', '#');
	$('#close').attr('href', '#');
	$('#icons span').css('max-width', 0);
}





// user volume size choice
$(document).on('input', '#volume', function() {
    volume_size = $(this).val();
});




// set up canvases
canvas_one = document.createElement('canvas');
visCtx_one = canvas_one.getContext("2d");
canvas_one.height = height;
canvas_one.width = width;
visCtx_one.globalAlpha = 0.1;
$( '#container' ).append(canvas_one);
newCanvas();





// tutorial scroll
$('#next').click(function(){
	if (tutorialCount < tutorial.length - 1) {
		tutorialCount++;
	}
	$('#next').attr('href', tutorial[tutorialCount]);
	disableButtons()
});

$('#prev').click(function(){
	if (tutorialCount > 0) {
		tutorialCount--;
	}
	$('#prev').attr('href', tutorial[tutorialCount]);
	disableButtons()
});

$('#skip').click(function(){
	if (started) {
		$('.popup').fadeOut(500);
	}
	$('#tutorialnavigation').fadeOut(500);
	$('#skip').fadeOut(500);
});

$('#close').click(function(){
	if (started) {
		$('.popup').fadeOut(500);
	}
	$('#reset').fadeOut(500);
	$('#settingsnavigation').fadeOut(500);
});

$(window).resize(function(){
	setTimeout(function(){
		scrollNeed();		
	}, 200)
});

$('#reset').click(function(){
	setRootNode(5);
	$( "#volume" ).val(50);
	volume_size = 50;
});

$('#about').click(function(){
	$('#settingsnavigation').fadeOut(500);
	$('#reset').fadeOut(500);
	
	$('#skip').fadeIn(500);
	$('#tutorialnavigation').fadeIn(500);
	tutorialCount = 0;
	disableButtons();
});

$('#icons').click(function(){
	if(started) {
		$('.popup').fadeIn(500);
	}
});

$('#settings').click(function(){
	$('#settingsnavigation').fadeIn(500);
	$('#reset').fadeIn(500);
	$('#skip').fadeOut(500);
	$('#tutorialnavigation').fadeOut(500);
})

$(document).ready(function(){
	$('#settingsnavigation').hide();
	$('#skip').hide();
	$('#tutorialnavigation').hide();
	$('#reset').hide();
	$('#end').hide();
	disableButtons();
	drawColorDemo();
	scrollNeed();
	setRootNode(5);
	$('#container').scrollTop((height - $(window).height()) / 2);
	$('#icons span').css('max-width', 300);
	$('#loading').hide();
});


$('#icons a').mouseenter(function(){
	$(this).children('span').css('max-width', 300);
});

$('#icons a').mouseleave(function(){
	if (started) {
		$(this).children('span').css('max-width', 0);
	}
});

var loading = setInterval(function(){
	$('#loading h1').html('Loading');
	setTimeout(function(){
		$('#loading h1').html('loading.');
	}, 500);
	setTimeout(function(){
		$('#loading h1').html('loading..');
	}, 1000);
	setTimeout(function(){
		$('#loading h1').html('loading...');
	}, 1500);
}, 2000)