"use strict";

function init() {
    Homey.log("Dagelijks Woord app started");

    Homey.manager('settings').set('BibleTranslation', 'bgt');
    Homey.log("BibleTranslation: bgt");

    var DW;//contains the vers of the day
    var DWready = false;//set to true when first api request succeeded
    var DWts;//timestamp, to keep track if it is a new one

    var http = require('http');
    var options =
    {
        method: 'get',
        protocol: 'http:',
        hostname: 'feed.dagelijkswoord.nl',
        path: '/api/json/1.0/',
        headers: {
            'Authorization': Homey.env.BASIC_OUTH_TOKEN
        }
    };

    function getDW() {
        http.get(options, function (res) {
            var DWresponse = '';  //create empty buffer for http response

            //Homey.log("statusCode: " + res.statusCode); //200 = OK, 40X = Someting is wrong

            res.on('data', function (chunk) { //parse all data
                DWresponse += chunk;
            })
                .on('end', function () { // When API call succeeded.
                    Homey.log("API call succeded.");
                    DW = JSON.parse(DWresponse);
                    if(DWts!=DW.data[0].ts)//check if it is a new one
                    {
                        //Homey.log(DW);
                        var BibleTranslationSetting = Homey.manager('settings').get('BibleTranslation'); //Get the saved BibleTranslation from settings
                        var DWverse = DW.data[0].source; //save verse
                        var DWtext = DW.data[0].text[BibleTranslationSetting]; //save text

                        //trigger flow card
                        Homey.manager('flow').trigger('newDW', {
                            'verse': DWverse,
                            'text': DWtext
                        }, {
                            'my_state': 'my_value'
                        }, function( err, success ){
                            if( err ) return console.error(err);
                        });

                        DWready = true;
                        DWts = DW.data[0].ts;
                        Homey.log("DW updated");
                    }
                });
        }).on('error', function (e) {
            Homey.log("API call error: " + e.message);
        });
    return true;
    }

    getDW();//update for the first time

    //tried to check if there is a task already registerd, delete the old one and register the new one

     /*Homey.manager('cron').unregisterTask("DWUpdate",function (err, success)  
     {
        if(err)
        {
            Homey.log("un err: " + err);
        }
        if(success)
        {
            Homey.log("un err: " + success);
        }
     });*/

    // Homey.manager('cron').getTasks(function(err, tasks)
    // {
    //     if(err)
    //     {
    //         Homey.log("getTasks error");
    //     }
    //     if(tasks)
    //     {
    //         for(var i=0; i<=tasks.length; i++)
    //         {
    //                 Homey.log("cron already registerd: " + JSON.stringify(tasks[i]));
    //         }
            
    //     }
    //     else
    //     {
            Homey.manager('cron').registerTask('DWUpdate', '0 1 * * *', 'x', function(err, task)
            {
                if(err)
                {
                    Homey.log("cron registration error: " + err);
                }
                if(task)
                {
                    Homey.log("cron registerd succes: " + JSON.stringify(task));
                }
            });
    //     } 
    // });


    //update DW at 1 AM
    Homey.manager('cron').on('DWUpdate', function (varx){
        //Homey.log("Cron fired: update DW");
        getDW();//update DW
    });

    Homey.manager('flow').on('action.readDW', function (callback, args) {
        Homey.log("Flow action");
        Homey.log("Card arguments:" + args.day +", "+ args.BibleTranslation);
        
        if(DWready)
        {
            var DWverse = DW.data[args.day].source; //save verse
            Homey.log("DWverse: " + DWverse);
            var DWtext = [];
            var DWtextRaw;
            DWtextRaw = DW.data[args.day].text[args.BibleTranslation]; //save text
            Homey.log("DWtext: " + DWtextRaw);
            DWtextRaw = DWtextRaw.replace('-', ' ');//do not say "dash" or someting like that

            //cut at last space every 255 chars
            if(DWtextRaw.length>=255)
            {
                var index = 0;
                for(var i=0; DWtextRaw.length>=255; i++)
                {
                    var DWtextHelper = DWtextRaw.substr(0, 255);
                    var DWtextIndexLastSpaceBefore255 = DWtextHelper.lastIndexOf(' ');
                    DWtext[i]=DWtextRaw.substr(0, DWtextIndexLastSpaceBefore255);
                    DWtextRaw = DWtextRaw.substr(DWtextIndexLastSpaceBefore255, DWtextRaw.length);
                    Homey.log("Part "+ i +" : " + DWtext[i]);
                    index = i;
                }
                DWtext[index+1]= DWtextRaw;
            }
            else
            {
                DWtext[0]= DWtextRaw;
            }

            //make the verse speech ready
            DWverse = DWverse.replace(':', ', vers ');
            DWverse = DWverse.replace('-', ' tot en met ');

            //read it using internal speakers
            Homey.manager('speech-output').say(__(DWverse));
            for (var i = 0; i < DWtext.length; i++) { 
                Homey.manager('speech-output').say(__(DWtext[i]));
            }
            callback(null, true);
        }
        else
        {
            Homey.manager('speech-output').say(__("Homey kon geen verbinding maken met de server van Dagelijks Woord."));
        }
    });

    Homey.manager('speech-input').on('speech', function (speech, callback) {
        // Iterate over every possible trigger as specified in app.json
        speech.triggers.forEach(function (trigger) {
            // Check if the bibleVerse trigger is triggered
            if (trigger.id === 'bibleVerse') {
                Homey.log("Speech trigger");
                var BibleTranslationSetting = Homey.manager('settings').get('BibleTranslation'); //Get the saved BibleTranslation from settings
                
                if(DWready)
                {
                    var DWverse = DW.data[0].source; //save verse
                    Homey.log("DWverse: " + DWverse);
                    var DWtext = [];
                    var DWtextRaw;
                    DWtextRaw = DW.data[0].text[BibleTranslationSetting]; //save text
                    Homey.log("DWtext: " + DWtextRaw);
                    DWtextRaw = DWtextRaw.replace('-', ' ');//do not say "dash" or someting like that

                    //cut at last space every 255 chars
                    if(DWtextRaw.length>=255)
                    {
                        var index = 0;
                        for(var i=0; DWtextRaw.length>=255; i++)
                        {
                            var DWtextHelper = DWtextRaw.substr(0, 255);
                            var DWtextIndexLastSpaceBefore255 = DWtextHelper.lastIndexOf(' ');
                            DWtext[i]=DWtextRaw.substr(0, DWtextIndexLastSpaceBefore255);
                            DWtextRaw = DWtextRaw.substr(DWtextIndexLastSpaceBefore255, DWtextRaw.length);
                            Homey.log("Part "+ i +" : " + DWtext[i]);
                            index = i;
                        }
                        DWtext[index+1]= DWtextRaw;
                    }
                    else
                    {
                        DWtext[0]= DWtextRaw;
                    }

                    //make the verse speech ready
                    DWverse = DWverse.replace(':', ', vers ');
                    DWverse = DWverse.replace('-', ' tot en met ');

                    //read it using the same devices as input device
                    speech.say(__(DWverse));
                    for (var i = 0; i < DWtext.length; i++) { 
                        speech.say(__(DWtext[i]));
                    }
                }
                else
                {
                    speech.say(__("Homey kon geen verbinding maken met de server van Dagelijks Woord."));
                }
            }
        });
    });
}

module.exports.init = init;