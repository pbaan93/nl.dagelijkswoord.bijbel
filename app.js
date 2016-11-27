/* global Homey, module */
(function() {
	'use strict';
}());
var DW; //contains the vers of the day
var ready = false; //set to true when first api request succeeded
var timestamp; //timestamp, to keep track if it is a new one
var getDW = null;
var options = null;
var createSpeechText = null;

function init() {
	Homey.log("Dagelijks Woord app started");
	Homey.manager('settings').set('BibleTranslation', 'bgt');
	Homey.log("BibleTranslation: bgt");
	getDW(); //update for the first time
}
String.prototype.beautify = function() {
	return this.replace('  ', '').trim();
};
createSpeechText = function(verse, textRaw) {
	var text = [];
	Homey.log("verse: " + verse);
	//make the verse speech ready
	verse = verse.replace(':', ', vers ');
	verse = verse.replace('-', ' tot en met ');
	text.push(verse);
	Homey.log("text: " + textRaw);
	//cut at last space every 255 chars
	var senetenceParts = textRaw.split(/[,.!\?\-:;]+/g);
	for (var i = 0; i < senetenceParts.length; i++) {
		if (senetenceParts[i].length >= 255) {
			var textHelper = senetenceParts[i].substr(0, 255);
			var textIndexLastSpaceBefore255 = senetenceParts[i].lastIndexOf(' ');
			text.push(senetenceParts[i].substr(0, textIndexLastSpaceBefore255).beautify());
			text.push(senetenceParts[i].substr(textIndexLastSpaceBefore255, senetenceParts[i].length).beautify());
		} else {
			text.push(senetenceParts[i].beautify());
		}
	}
	return text.filter(Boolean);
};
getDW = function() {
	var http = require('http');
	options = {
		method: 'get',
		protocol: 'http:',
		hostname: 'feed.dagelijkswoord.nl',
		path: '/api/json/1.0/',
		headers: {
			'Authorization': Homey.env.BASIC_OUTH_TOKEN
		}
	};
	Homey.log(options);
	http.get(options, function(res) {
		var response = ''; //create empty buffer for http response
		//Homey.log("statusCode: " + res.statusCode); //200 = OK, 40X = Someting is wrong
		res.setEncoding('utf8');
		res.on('data', function(chunk) { //parse all data
			response += chunk;
		}).on('end', function() { // When API call succeeded.
			Homey.log("API call succeded.");
			DW = JSON.parse(response);
			if (timestamp !== DW.data[0].ts) { //check if it is a new one
				var BibleTranslationSetting = Homey.manager('settings').get('BibleTranslation'); //Get the saved BibleTranslation from settings
				var verse = DW.data[0].source; //save verse
				var text = DW.data[0].text[BibleTranslationSetting]; //save text
				//trigger flow card
				Homey.manager('flow').trigger('newDW', {
					'verse': verse,
					'text': text
				}, function(err, success) {
					if (err) return Homey.log(err);
				});
				ready = true;
				timestamp = DW.data[0].ts;
				Homey.log("Dagelijks Woord updated");
			}
		});
	}).on('error', function(e) {
		Homey.log("API call error: " + e.message);
	});
	return true;
};
Homey.manager('cron').registerTask('DWUpdate', '0 1 * * *', 'x', function(err, task) {
	if (err) {
		Homey.log("cron registration error: " + err);
	}
	if (task) {
		Homey.log("cron registerd succes: " + JSON.stringify(task));
	}
});
//update DW at 1 AM
Homey.manager('cron').on('DWUpdate', function(varx) {
	//Homey.log("Cron fired: update DW");
	getDW(); //update DW
});
Homey.manager('flow').on('action.readDW', function(callback, args) {
	Homey.log("Flow action");
	Homey.log("Card arguments:" + args.day + ", " + args.BibleTranslation);
	if (DW !== undefined) {
		var text = createSpeechText(DW.data[args.day].source, DW.data[args.day].text[args.BibleTranslation]);
		if (ready) {
			//read it using internal speakers
			for (var i = 0; i < text.length; i++) {
				Homey.manager('speech-output').say(__(text[i]));
			}
			callback(null, true);
		} else {
			Homey.manager('speech-output').say(__("Homey kon geen verbinding maken met het Dagelijks Woord."));
		}
	}
});
Homey.manager('speech-input').on('speech', function(speech, callback) {
	// Iterate over every possible trigger as specified in app.json
	speech.triggers.forEach(function(trigger) {
		// Check if the bibleVerse trigger is triggered
		if (trigger.id === 'bibleVerse') {
			Homey.log("Speech trigger");
			var BibleTranslationSetting = Homey.manager('settings').get('BibleTranslation'); //Get the saved BibleTranslation from settings
			if (ready) {
				var text = createSpeechText(DW.data[0].source, DW.data[0].text[BibleTranslationSetting]);
				for (var i = 0; i < text.length; i++) {
					speech.say(__(text[i]));
				}
			} else {
				speech.say(__("Homey kon geen verbinding maken met het Dagelijks Woord."));
			}
		}
	});
});
module.exports.init = init;