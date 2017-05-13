var smm = require('super-mario-maker-client');
var tmi = require('tmi.js');
var dbutils = require('./utils/dbutils');
var utils = require('./utils/utils');
var http = require('http');
var https = require('https');
var uid = require('mongodb').ObjectID;
var validator = require('youtube-validator');
var client = require('socket.io/node_modules/socket.io-client');

var song_client = require('socket.io/node_modules/socket.io-client');
require('dotenv').config();
var bot_id = process.env.BOT_ID;
var bot_secret = process.env.BOT_SECRET;

var db;

var tmi_options = {
	options:{
		debug: true
	},
	connection:{
		reconnect: true
	},
	identity:{
		username: "SPaDeSPwnzBot",
		password: process.env.BOT_OAUTH
	},
	channels: ["#spades_live"]

};
var trivia_on = false;
var trivia_question_solved = false;
var trivia_timeout = 3;
var trivia_answer = "";
var trivia_categories = [];
var trivia_clue = "";
var already_guessed = [];
var trivia_choices = true;
var admin = 'spades_live';
var mods = ['miamiandy513', 'yungtdot'];
var chatterTypes = ['moderators','staff','admins','global_mods','viewers'];
var channel = "#spades_live";
var bot = new tmi.client(tmi_options);
var day = 1;
var on_msg_cooldown = false;
var cgss_messages = [
	'You hit the wrong gravity switch.',
	'You get the perfect lineup on the white tile, but then your finger twitches and you die.',
	'You spindash at the perfect angle. Too bad you missed the jump input!',
	'Wait, what is the camera doing? Oh, I\'m dead.',
	'You changed your angle too slow. Now you\'re dead',
	'Everything is going perfect as you\'re making it past the kill walls. Nevermind, you hit one at the last second.',
	'As you\'re falling to the goal, you hold your controlstick at the wrong angle. R I P',
	'You fall through the perfect spot on the green wall but miss the visual queue on the space debris. So close, and yet so far away.',
	'You land on the roof of the goal. You jump down and homing attack the goal ring, but the attack misses. LOL',
	'PERFECT spindash, perfect angle, perfect homing attack cancel. You GOT this! j/k you overshoot the goal ring by 2 pixels.',
	'You do a perfect CGSS. Too bad it\'s after 3 deaths. Oh well, good enough. You gain some points!'
]
var smm_messages = [
		'You gain 1 point every 20 minutes while watching. Type !points to see your amount.',
		'Type !queue to see how many levels are in the queue.',
		'You can see completed (or failed) viewer levels at http://www.spades.tech/stream/smm.',
		'24H stream at 500 followers! Hit that follow button if you\'re enjoying the stream.',
		'Type !submit [CODE] to add your level to the queue',

		'Use !song [YOUTUBE URL] to add a song to the queue',
		'Your points are currently useless, so for 5 points, !suggest [IDEA] me some ideas',
		'Each level will get around 10 minutes unless it doesnt',
];

var other_messages = [
		'You gain 1 point every 20 minutes while watching. Type !points to see your amount',
		'24H stream at 500 followers! Hit that follow button if you\'re enjoying the stream.',
		'Tell a friend to come type !ref [YOUR USERNAME] in chat to receive 2 points!',
		'Gamble your points away with !cgss.',
		'Your points are currently useless, so for 5 points, !suggest [IDEA] me some ideas.',
		'Im currently trying to become less bad at SA2B, might have a decent time sometime.',
		'Upcoming potential stream plans: Centurion Saturdays and Meme Game Mondays (Sonic 06 first?)',
];

var users_on_cooldown = [];
var message_type = 'other'
bot.connect();
console.log("BOT ON");

(function() {
	var pointInterval = setInterval(function() {
		checkOnline(function(status) {
			if (status) {
				getViewers(function(parsed) {
					for (var type = 0; type<chatterTypes.length;type++) {
						for (var i = 0; i< parsed.chatters[chatterTypes[type]].length;i++) {
							addPoints(parsed.chatters[chatterTypes[type]][i], 1);
							
						}
					}
				});
			}
		});
		pingSite();
		sendNote();
	},1000*60*20);
})();

(function() {
	var triviaInterval = setInterval(function() {
		if (trivia_on) {
			if (!trivia_question_solved) {
				if (trivia_answer != "") {
					bot.say(channel, "The Correct Answer was: "+trivia_answer);
				}
			}
			question();
		}	
	},1000*60*trivia_timeout);
})();

bot.on("chat", function(channel, userstate, message, self) {
	if (self) return;
	var message_parts = message.split(' ');
	var user = userstate.username;
	switch (message_parts[0]) {
		case "!suggest":
			findPoints(user, function(points) {
				if (points > 5) {
					decPoints(user, 5);
					suggest(message.slice(9), user);
				}
			})
			break;
		case "!suggestgame":
			suggest(message.slice(9), user);
			break;
		case "!checkonline":
			checkOnline(function(status) {
				if (status == true) {
					bot.say(channel, 'Online!');
				}
				else{
					bot.say(channel, 'Offline :(');
				}
			});

			break;
		case "!points":
			findPoints(user, function(points) {

				bot.say(channel, "@"+user+" "+points+" points.");
			});
			break;
		case "!intel":
			findIntel(user, function(points) {

				bot.say(channel, "@"+user+" "+points+" intel.");
			});
			break;
		case "!add":
			if (message_parts.length == 2 && message_parts[1].length == 19) {
				var code = message_parts[1];
				findLevelByCode(code, function(found_level) {
					if (found_level) {
						bot.say(channel, "@" + user + " Level already " + found_level[0].type);
						return;
					}
					levelQueued(user, function(user_queue) {
						if (user_queue) {
							bot.say(channel, "@" + user + " Max 1 queue / person");
							return;
						}
						smm.fetchCourse(code, function(error, course) {
							if (error) {
								bot.say(channel, "Error submitting level, invalid code?");
								return;
							}
							if (course == undefined) {
								bot.say(channel, "Error submitting level, invalid code?");
								return;
							}
							var title = course.title;
							var maker = course.creator.miiName;
							var percent = course.clearRate;
							var style = course.gameStyle;
							var img = course.thumbnailUrl;
							var level = {user: user, code: code, title: title, maker: maker, style: style, img: img,percent: percent, id: new uid()};
							addToSMMQueue(level, function(success) {
								if (success) {
									bot.say(channel,'@'+user+' Added "'+title+'" by '+maker+' ['+percent+'%]');
								} else {
									bot.say(channel,'@'+user+' failed to add.');
								}
							})
						}); //End Fetch Level Callback
					}); //End Level Queued Callback
				}); //End Find Level Callback
			}
			else{
				bot.say(channel, "Incorrect format, '!submit ABCD-1234-ABCD-1234");
			}
			break;
		case "!tadd":
			if (message_parts.length == 2 && message_parts[1].length == 19) {
				var code = message_parts[1];
				smm.fetchCourse(code, function(error, course) {
					if (error) {
						bot.say(channel, "Error submitting level. Invalid code?");
						return;
					}
					if (course == undefined) {
						bot.say(channel, "Error submitting level. Invalid code?");
						return;
					}
					var title = course.title;
					var maker = course.creator.miiName;
					var percent = course.clearRate;
					var style = course.gameStyle;
					var img = course.thumbnailUrl;
					var level = {user: user, code: code, title: title, maker: maker, style: style, img: img,percent: percent, id: new uid()};
					addToSMMQueue(level, function(success) {
						if (success) {
							bot.say(channel,'@'+user+' Added "'+title+'" by '+maker+' ['+percent+'%]');
						} else {
							bot.say(channel,'@'+user+' failed to add.');
						}
					})
				}); //End Fetch Level Callback
			} else {
				bot.say(channel, "Incorrect format. '!submit ABCD-1234-ABCD-1234");
			}
			break;
		case "!submit":
			if (message_parts.length == 2 && message_parts[1].length == 19) {
				var code = message_parts[1];
				findLevelByCode(code, function(found_level) {
					if (found_level) {
						bot.say(channel, "@"+user+" Level already "+found_level[0].type);
						return;
					}
					levelQueued(user, function(user_queue) {
						if (user_queue) {
							bot.say(channel, "@"+user+" Max 1 queue / person");
							return;
						}
						smm.fetchCourse(code, function(error, course) {
							if (error) {
								bot.say(channel, "Error submitting level, invalid code?");
								return;
							}
							if (course == undefined) {
								bot.say(channel, "Error submitting level, invalid code?");
								return;
							}
							var title = course.title;
							var maker = course.creator.miiName;
							var percent = course.clearRate;
							var style = course.gameStyle;
							var img = course.thumbnailUrl;
							var level = {user: user, code: code, title: title, maker: maker, style: style, img: img,percent: percent, id: new uid()};
							addToSMMQueue(level, function(success) {
								if (success) {
									bot.say(channel,'@'+user+' Added "'+title+'" by '+maker+' ['+percent+'%]');
								} else {
									bot.say(channel,'@'+user+' failed to add.');
								}
							})
						}); //End Fetch Level Callback
					}); //End Level Queued Callback
				}); //End Find Level Callback
			}
			else{
				bot.say(channel, "Incorrect format, '!submit ABCD-1234-ABCD-1234");
			}
			break;
		case "!priority":
			findPoints(user, function(points) {
				if (points >= 10) {
					if (message_parts.length == 2 && message_parts[1].length == 19) {
						var code = message_parts[1];
						findLevelByCode(code, function(found_level) {
							if (found_level) {
								bot.say(channel, "@"+user+" Level already "+found_level[0].type);
								return;
							}
							levelQueued(user, function(user_queue) {
								if (user_queue) {
									bot.say(channel, "@"+user+" Max 1 queue / person");
									return;
								}
								smm.fetchCourse(code, function(error, course) {
									if (error) {
										bot.say(channel, "Error submitting level, invalid code?");
										return;
									}
									if (course == undefined) {
										bot.say(channel, "Error submitting level, invalid code?");
										return;
									}
									var title = course.title;
									var maker = course.creator.miiName;
									var percent = course.clearRate;
									var style = course.gameStyle;
									var level = {user: user, code: code, title: title, maker: maker, style: style, percent: percent, id: new uid()};
									addToSMMPrioQueue(level, function(success) {
										if (success) {
											decPoints(user, 10);
											bot.say(channel,'@'+user+' Added "'+title+'" by '+maker+' ['+percent+'%]');
										} else {
											bot.say(channel,'@'+user+' failed to add.');
										}
									});
								}); //End Fetch
							}); //End Queue Check
						}); //End Level Checl
					} else {
						bot.say(channel, "Incorrect format, '!submit ABCD-1234-ABCD-1234");
					}
				} else {
					bot.say(channel, "@"+user+ "Not enough points. Cost: 5, Have: "+points);
				}
			})
			break;
		case "!switch":
			findPoints(user, function(points) {
				if (points >= 10) {
					levelQueued(user, function(found_level) {
						if (found_level) {
							if (found_level[0]) {
								if (found_level[0].type == 'queue') {
									level = found_level[0].level[0];
									deleteByCode(level.code, function(del_success) {
										addToSMMPrioQueue(level, function(add_success) {
											decPoints(user, 10);
											bot.say(channel,"@"+user+" switched level to priority queue");
										});
									});
								}
							}
						}
					})
				}
			});
			break;
		case "!queue":
			var regular_queue;
			var prio_queue;
			var parts_done = 0;
			getSMMQueue(function (queue) {
				regular_queue = queue[0];
				if (!regular_queue) {
					regular_queue = {level: []};
				}
				if (!regular_queue.level) {
					regular_queue.level = [];
				}
				parts_done++;
				if (parts_done == 2) {

					var next_line = "";
					for (var i = 0; i<3;i++) {
						if (prio_queue.level[i]) {
							next_line += '['+prio_queue.level[i].user+' - '+ prio_queue.level[i].code+'] ';
						}
						else if (regular_queue.level[i-prio_queue.level.length]) {

							next_line += '['+regular_queue.level[i-prio_queue.level.length].user+' - '+ regular_queue.level[i-prio_queue.level.length].code+'] ';

						}

					}
					bot.say(channel, "Regu Queue: "+regular_queue.level.length+" | | Prio Queue: "+prio_queue.level.length+'| | Next:'+next_line);
				}
			});
			getSMMPrioQueue(function (queue) {
				prio_queue = queue[0];
				if (!prio_queue) {
					prio_queue = {level: []};
				}
				if (!prio_queue.level) {
					prio_queue.level = [];
				}
				parts_done++;
				if (parts_done == 2) {
					var next_line = "";
					for (var i = 0; i < 3; i++) {
						if (prio_queue.level[i]) {
							next_line += '['+prio_queue.level[i].user+' - '+ prio_queue.level[i].code+'] ';
						} else if (regular_queue.level[i-prio_queue.level.length]) {
							next_line += '['+regular_queue.level[i-prio_queue.level.length].user+' - '+ regular_queue.level[i-prio_queue.level.length].code+'] ';
						}

					}
					bot.say(channel, "Regu Queue: "+regular_queue.level.length+" | | Prio Queue: "+prio_queue.level.length+'| | Next:'+next_line);
				}
			});
			break;
		case "!complete":
			if (user == admin) {
				if (message_parts.length == 3) {
					var type = message_parts[1];
					var spot;
					try{
						spot = parseInt(message_parts[2]);
					}
					catch(e) {
						break;
					}
					addToSMMComplete(type, spot, function(success) {
						bot.say(channel, success ? "Completed Level!" : "Failed Completing level :(")
					});
				}
			}
			break;
		case "!fail":
			if (user == admin) {
				if (message_parts.length == 3) {
					var type = message_parts[1];
					var spot;
					try{
						spot = parseInt(message_parts[2]);
					}
					catch(e) {
						break;
					}
					addToSMMFail(type, spot, function(success) {
						bot.say(channel, success ? "Completed failed!" : "Failed Failing level (wait wut) :(")
					});
				}
			}
			break;
		case "!delete":
			if (user == admin) {
				if (message_parts.length == 3) {
					var type = message_parts[1];
					var spot;
					try{
						spot = parseInt(message_parts[2]);
					}
					catch(e) {
						break;
					}
					deleteFromQueue(type, spot, function(success) {
						bot.say(channel, success ? "Completed removed" : "Failed removing level")
					});
				}
			}
			break;
		case "!check":
			var code = message_parts[1];
			findLevelByCode(code, function(item) {
				console.log(item);
			});
			break;
		case "!isqueued":
			var user_to_check = message_parts[1];
			levelQueued(user_to_check,function(level) {
				console.log(level);
			});
		case "!clear":
			if (message_parts[1] != 'queue') {
				return;
			}
			if (user != admin) {
				return;
			}
			clearQueue(function() {
				bot.say(channel, "Queues Cleared");
			})
			break;
		case "!ref":
			if (message_parts.length != 2) {
				bot.say(channel, "@"+user+" Incorrect Format");
				return;
			}
			var to_user = message_parts[1];
			if (to_user == user) {
				bot.say("@"+user+" cannot refer yourself!");
				return;
			}
			refUser(user,to_user, function(success) {
				if (success) {
					bot.say(channel, "Gave @"+to_user+" 2 points");
				}
				else{
					bot.say(channel, "@"+user+" reference already used.");
				}
			});
			break;
		case "!day":
			if (user == admin) {
				day = message_parts[1];
				bot.say(channel, "Now day: "+day);
			}
			break;
		case "!msgtype":
			if (user == admin) {
				message_type = message_parts[1];
			}
			break;
		case "!song":
			songUrl = message_parts[1];
			var useUrl = songUrl;
			if (songUrl.substring(0,8) == 'https://') {
				useUrl = songUrl.substring(8);
			}
			if (useUrl.indexOf('.be/') > 0) {
				var id = useUrl.substring(useUrl.indexOf('.be/')+4);
				useUrl = 'http://www.youtube.com/watch?v='+id;
			}
			if (useUrl.indexOf('&list=') > 0) {
				useUrl = useUrl.substring(0,useUrl.indexOf('&list='));
			
			}
			validSong(useUrl, function(success) {
				if (success) {
					client.emit('new_song', useUrl);
				}
				bot.say(channel, success ? 'Song Added!' : "Invalid Song :(");
			})
			break;
		case "!nextsong":
			if (user == admin || mods.indexOf(user) >= 0) {
				client.emit('skip');
			}
			break;
		case '!currentsong':
			song_client.emit('request_song');
			break;
		case '!resetsongs':
			if (user == admin) {
				song_client.emit('reset');
			}
			break;
		case '!setsong':
			if (message_parts[1] == 'help') {
				bot.say(channel,'http://www.pastebin.com/hKz594S0');
				return;
			}
			if (message_parts.length < 3) {
				bot.say(channel, 'Incorrect Format: !setsong stage song http://www.pastebin.com/xXrYavVq');
				return;
			}
			findPoints(user, function(points) {
				if (points >= 1) {
					song_client.emit('song_change', user, message_parts.slice(2).join(""), message_parts[1]);
				}
				else{
					bot.say(channel, "@"+user+" not enough points");
				}
			});
			break;
		case "!giveall":
			if (user == admin) {
				var amount = parseInt(message_parts[1]);
				getViewers(function(parsed) {
					for (var type = 0; type<chatterTypes.length;type++) {
						for (var i = 0; i< parsed.chatters[chatterTypes[type]].length;i++) {
							addPoints(parsed.chatters[chatterTypes[type]][i], amount);
							
						}
					}
					bot.say(channel,"Points Given");
				});
			}
			break;
		case "!cgss":
			var multi = 1;
			if (users_on_cooldown.indexOf(user) < 0) {
				if (on_msg_cooldown == false) {
					if (message_parts.length > 1) {
						multi = parseInt(message_parts[1]);
						if (multi <= 0) {
							multi = 1;
						}
					}
					lock(user);
					message_delay();
					findPoints(user, function(points) {
						if (points >= multi) {
							decPoints(user, multi);
							var roll = Math.floor(Math.random() * (10 + 1));
							if (roll == 10) {
								addPoints(user, 15*multi);
							}
							bot.say(channel, '@'+user+' '+cgss_messages[roll]);
						}
						else{
							bot.say(channel, "@"+user+" not enough points :(");
						}
					})
				}
			}
			break;	
		case "!triviaon":
			if (user == admin || mods.indexOf(user) >= 0 ) {
				trivia_on = true;
				bot.say(channel,'Trivia Enabled');
			}
			break;
		case "!triviaoff":
			if (user == admin || mods.indexOf(user) >= 0 ) {
				trivia_on = false;
				bot.say(channel,'Trivia Disabled');
			}
			break;
		case "!addcat":
			if (user == admin || mods.indexOf(user) >= 0) {
				add_trivia_category(message_parts[1]);
			}
			break;

		case "!removecat":
			if (user == admin || mods.indexOf(user) >= 0) {
				remove_trivia_category(message_parts[1]);
			}
			break;
		case "!choice_on":
			if (user == admin || mods.indexOf(user) >= 0) {
				trivia_choices = true;
				bot.say(channel,"Choices will be dislayed");
			}
			break;
		case "!choice_off":
			if (user == admin || mods.indexOf(user) >= 0) {
				trivia_choices = false;
				bot.say(channel,"Choices will be NOT dislayed");
			}
			break;
		case "!question":
			if (user == admin || mods.indexOf(user) >= 0) {
				question();
			}
			break;

		case "!trivia_time":
			if (user == admin || mods.indexOf(user) >= 0) {
				if (message_parts.length >= 2) {
					var t = parseInt(message_parts[1]);
					if (t > 0 & t < 10) {
						trivia_timeout = t;
					}
					bot.say(channel,"Trivia Timeout set to "+t);
				}
			}
			break;
		case "!trivia_categories":
			announce_categories();
			break;
		case "!trivia_using":
			bot.say(channel,""+trivia_categories);
			break;
		case "!exchange":
			findIntel(user, function(intel) {
				if (parseInt(message_parts[1]) <= 0) {
					return;
				}
				if (intel >= parseInt(message_parts[1])) {
					decIntel(user, parseInt(message_parts[1]));
					addPoints(user, parseInt(message_parts[1])*3);
					bot.say(channel, "@"+user+" added "+parseInt(message_parts[1])*3+"points");
				}
			})
			break;
	}
	if (!trivia_question_solved) {
		if (message.toLowerCase() == trivia_answer) {
			if (already_guessed.indexOf(user) < 0) {
				answer_correct(user);
			}
		}
		if (already_guessed.indexOf(user) < 0) {
			if (trivia_clue.indexOf(message.toLowerCase()) > -1) {
				already_guessed.push(user);
			}
		}
	}
});

function answer_correct(user) {
	trivia_question_solved = true;
	addIntel(user, 1);
	bot.say(channel, "@"+user+" is correct! You gain 1 intel");
}

function question() {
	if (trivia_categories.length == 0) {
		trivia_answer = null;
		bot.say(channel, "No Categories Added");
	}
	else{
		already_guessed = [];
		var choose_cat = parseInt(Math.floor(Math.random() * (trivia_categories.length)));
		trivia_question_solved = false;
		db.collection('trivia').find( {"category":trivia_categories[choose_cat]}).toArray(function(err, cursor) {
			if (err) {
				bot.say(channel, "Whoever coded me is bad");
				return null;
			}
			else{
				if (cursor[0]) {
					if (cursor[0].questions) {
						var count = cursor[0].questions.length;
						var choose_q = parseInt(Math.floor(Math.random() * (count + 1)));
						var t_question = cursor[0].questions[choose_q].question;
						trivia_clue = t_question.substring(t_question.indexOf('[')).toLowerCase();
					
						if (!trivia_choices) {
							t_question = t_question.substring(0, t_question.indexOf('['));
						}
						bot.say(channel,'['+trivia_categories[choose_cat]+'] '+t_question)
						trivia_answer = cursor[0].questions[choose_q].answer.toLowerCase();
						
					}
					else{
						
						bot.say(channel, "Whoever coded me is bad");
					}
				}
				else{
					
					bot.say(channel, "Whoever coded me is bad");
				}
			}
		});
	}
}

function question_solved() {}

function announce_categories() {
	db.collection('trivia').find( {"category":"category_list"}).toArray(function(err, cursor) {
		if (err) {
			bot.say(channel,"None");

		}
		else{
			if (cursor[0]) {
				if (cursor[0].categories) {
					bot.say(channel,""+cursor[0].categories);
					
				}
				else{
					
					bot.say(channel,"None");
				}
			}
			else{
				bot.say(channel,"None");
			}
		}
	});
};

function add_trivia_category(cat) {
	db.collection('trivia').find( {"category":"category_list"}).toArray(function(err, cursor) {
		if (err) {
			bot.say(channel,"Category Not Found");

		}
		else{
			if (cursor[0]) {
				if (cursor[0].categories) {
					if (cursor[0].categories.indexOf(cat) >= 0) {
						trivia_categories.push(cat);
						bot.say(channel,"Category Added");
					}
				}
				else{
					
					bot.say(channel,"Category Not Found");
				}
			}
			else{
				bot.say(channel,"Category Not Found");
			}
		}
	});
};

function remove_trivia_category(cat) {
	var spot = trivia_categories.indexOf(cat);
	if (spot > -1) {
		trivia_categories.splice(spot,1);
	}
	
	bot.say(channel,"Category Removed");
};

function freeUser(user) {
	var spot = users_on_cooldown.indexOf(user);
	if (spot > -1) {
		users_on_cooldown.splice(spot, 1);
	}
}

function validSong(url, callback) {
	validator.validateUrl(url, function(res, err) {
		if (err) {
			console.log(err);
			callback(false);
		}
		else{
			callback(true);
		}
	});
}

function refUser(from_user, to_user, callback) {
	to_user = to_user.toLowerCase();
	db.collection('stream_stats').find({'type':'used_ref_list'}).toArray(function(err,cursor) {
		if (err) {
			return null;
		}
		if (cursor) {
			if (cursor.length == 0) {
				dbutils.db_upsert(db,'stream_stats',{'type':'used_ref_list'},{'users':from_user}, function(res) {
					if (res.fail == true) {
						return null;
					} else {
						addPoints(to_user, 2);
						callback(true);
						return;
					}
				});
			} else {
				if (cursor[0].users.indexOf(from_user) < 0) {
					dbutils.db_upsert(db,'stream_stats',{'type':'used_ref_list'},{'users':from_user}, function(res){
						if (res.fail == true) {
							return null;
						}
						else{
							addPoints(to_user, 2);
							callback(true);
							return;
						}
					});
				} else {
					callback(false)
				}
			}
		} else {
			return null;
		}
	});
};

function lock(user) {
	users_on_cooldown.push(user);
	setTimeout(
		function() {
			freeUser(user)
		}, 60000);
}

function message_delay() {
	on_msg_cooldown = true;
	setTimeout(function() {
		on_msg_cooldown = false;
	}, 5000);
}

function clearQueue(callback) {
	db.collection('SMM').update({$or: [{'type':'prio_queue'},{'type':'queue'}]},{$set:{level: []}},{multi: true, upsert: true}, function(err){
		if (err) {

		}
		else{
			callback();
		}
	});
};

function levelQueued(user, callback) {
	db.collection('SMM').find( {"level.user":user, $or: [{'type':'prio_queue'},{'type':'queue'}]}, {level: {  $elemMatch: {user: user} }, type: 1}).toArray( function(err, cursor){
		if (err) {
			null;
		}
		else{
			if (cursor) {
				if (cursor.length == 0) {
					callback(null);
				}
				else{
					callback(cursor)
				}
			}
			else{
				callback(null);
			}
		}
	});
}

function findLevelByCode(code, callback) {
	db.collection('SMM').find( {"level.code":code}, {level: {  $elemMatch: {code: code} }, type: 1}).toArray( function(err, cursor){
		if (err) {
			null;
		}
		else{
			if (cursor) {
				if (cursor.length == 0) {
					callback(null);
				}
				else{
					callback(cursor)
				}
			}
			else{
				callback(null);
			}
		}
	});
}

function deleteByCode(code, callback) {
	dbutils.db_pull(db, 'SMM', {"type":"prio_queue"}, {"level": {code: level.code}}, function(res) {
		callback(true)
	});
}

function deleteFromQueue(type, place, callback) {
	if (type == "queue") {
		getSMMQueue(function (queue) {
			queue = queue[0];
			if (!queue) {
				callback(false);
				return;
			}
			if (!queue.level) {
				callback(false);
				return;
			}
			place = place - 1;
			if (!queue.level[place]) {
				callback(false);
				return;
			}
			var level = queue.level[place];
	
			dbutils.db_pull(db, 'SMM', {"type":"queue"}, {"level": {code: level.code}}, function(res) {
				callback(true)
			});

		});
	}
	else if (type == "prio") {
		getSMMPrioQueue(function (queue) {
			queue = queue[0];
			if (!queue) {
				callback(false);
				return;
			}
			if (!queue.level) {
				callback(false);
				return;
			}
			place = place - 1;
			if (!queue.level[place]) {
				callback(false);
				return;
			}
			var level = queue.level[place];
			dbutils.db_pull(db, 'SMM', {"type":"prio_queue"}, {"level": {code: level.code}}, function(res){
				callback(true)
			});
		});
	}
	else{
		callback(false);
	}
}

function addToSMMComplete(type, place, callback) {
	if (type == "queue") {
		getSMMQueue(function (queue) {
			queue = queue[0];
			if (!queue || queue.level) {
				callback(false);
				return;
			}
			place = place - 1;
			if (!queue.level[place]) {
				callback(false);
				return;
			}
			var level = queue.level[place];
			dbutils.db_upsert(db, 'SMM', {"type":"completed"}, {"level":level}, function(in_push_result) {
				if (in_push_result.fail == true) {
					//Error adding notelist for user
					callback(false)
				}
				else{
					dbutils.db_pull(db, 'SMM', {"type":"queue"}, {"level": {code: level.code}}, function(res) {
						callback(true)
					});
				}
			});
		});
	}
	else if (type == "prio") {
		getSMMPrioQueue(function (queue) {
			queue = queue[0];
			if (!queue) {
				callback(false);
				return;
			}
			if (!queue.level) {
				callback(false);
				return;
			}
			place = place - 1;
			if (!queue.level[place]) {
				callback(false);
				return;
			}
			var level = queue.level[place];
			dbutils.db_upsert(db, 'SMM', {"type":"completed"}, {"level":level}, function(in_push_result) {
				if (in_push_result.fail == true) {
					//Error adding notelist for user
					callback(false)
				}
				else{
					dbutils.db_pull(db, 'SMM', {"type":"prio_queue"}, {"level": {code: level.code}}, function(res) {
						callback(true)
					});
				
				}
			});
		});
	}
	else{
		callback(false);
	}
}

function addToSMMFail(type, place, callback) {
	if (type == "queue") {
		getSMMQueue(function (queue) {
			queue = queue[0];
			if (!queue) {
				callback(false);
				return;
			}
			if (!queue.level) {
				callback(false);
				return;
			}
			place = place - 1;
			if (!queue.level[place]) {
				callback(false);
				return;
			}
			var level = queue.level[place];
			dbutils.db_upsert(db, 'SMM', {"type":"failed"}, {"level":level}, function(in_push_result) {
				if (in_push_result.fail) {
					//Error adding notelist for user
					callback(false)
				} else {
					dbutils.db_pull(db, 'SMM', {"type":"queue"}, {"level": {code: level.code}}, function(res) {
						callback(true)
					});
				
				}
			});
		});
	}
	else if (type == "prio") {
		getSMMPrioQueue(function (queue) {
			queue = queue[0];
			if (!queue || !queue.level) {
				callback(false);
				return;
			place = place - 1;
			if (!queue.level[place]) {
				callback(false);
				return;
			}
			var level = queue.level[place];
			dbutils.db_upsert(db, 'SMM', {"type":"failed"}, {"level":level}, function(in_push_result) {
				if (in_push_result.fail) {
					//Error adding notelist for user
					callback(false)
				}
				else{
					dbutils.db_pull(db, 'SMM', {"type":"prio_queue"}, {"level": {code: level.code}}, function(res) {
						callback(true)
					});
				}
			});
		});
	} else {
		callback(false);
	}
}
function addToSMMQueue(level, callback) {
	dbutils.db_upsert(db, 'SMM', {"type":"queue"}, {"level":level}, function(in_push_result) {
		callback(!in_push_result.fail)
	});
}

function addToSMMPrioQueue(level, callback) {
	dbutils.db_upsert(db, 'SMM', {"type":"prio_queue"}, {"level":level}, function(in_push_result) {
		callback(!in_push_result.fail)
	});
}

function getSMMQueue(callback) {
	db.collection('SMM').find( {"type":"queue"}).toArray(function(err, cursor) {
		if (err) {
			return null;
		}
		if (cursor) {
			callback(cursor);
		} else {
			return callback([]);
		}
	});
}

function getSMMPrioQueue(callback) {
		db.collection('SMM').find( {"type":"prio_queue"}).toArray(function(err, cursor) {
		if (err) {
			return null;
		}
		if (cursor) {
			callback(cursor);
		} else {
			return callback([]);
		}
	});
}

function addPoints(user, amount) {
	db.collection('points').update( {"user":user}, {$inc: {points: amount}, $set: {"user":user}},{upsert: true});
};

function decPoints(user, amount) {
	db.collection('points').update( {"user":user}, {$inc: {points: amount*-1}, $set: {"user":user}},{upsert: true});
};
function addIntel(user, amount) {
	db.collection('points').update( {"user":user}, {$inc: {intel: amount}, $set: {"user":user}},{upsert: true});
};

function decIntel(user, amount) {
	db.collection('points').update( {"user":user}, {$inc: {intel: amount*-1}, $set: {"user":user}},{upsert: true});
};

function findPoints(user, callback) {
	db.collection('points').find( {"user":user}).toArray(function(err, cursor) {
		if (err) {
			res.send("Error loading images");
		}
		else{
			if (cursor[0]) {
				if (cursor[0].points) {
					callback(cursor[0].points);
				}
				else{
					callback(0);
				}
			}
			else{
				callback(0);
			}
		}
	});
}

function findIntel(user, callback) {
		db.collection('points').find( {"user":user}).toArray(function(err, cursor) {
		if (err) {
			res.send("Error loading images");
		} else {
			if (cursor[0]) {
				if (cursor[0].intel) {
					callback(cursor[0].intel);
				} else {
					callback(0);
				}
			} else {
				callback(0);
			}
		}
	});
}

function suggest(suggestion, user) {
	dbutils.db_upsert(db, 'suggestion', {"type":"suggest_list"}, {"game_suggestions":{game: suggestion, from_user: user}}, function(in_push_result){
		bot.say(channel, "@"+user+(in_push_result.fail ? ' failed to add suggestion.' : ' your suggestion was added.'));}
			  });
}

function getViewers(callback) {
	http.get({
		host: 'tmi.twitch.tv',
		path: '/group/user/spades_live/chatters',
	}, function(res) {
		var body = '';
		res.on('data', function(d) {
			body += d;
		});
		res.on('end', function() {
			var parsed = JSON.parse(body);
			callback(parsed);			
		});
	})
}

function checkOnline(callback) {
	https.get({
		host: 'api.twitch.tv',
		path: '/kraken/streams/spades_live',
		headers: {'Client-ID': 'g9112834cyysblntbe474sc099s00d'}
	}, function(res) {
		var body = '';
		res.on('data', function(d) {
			body += d;
		});
		res.on('end', function() {
			var parsed = JSON.parse(body);
			callback(parsed.stream != null);
		});
	})
}

function pingSite() {
		http.get({
		host: 'www.spades.tech',
		path: '/',
	}, function(res) {
		var body = '';
		res.on('data', function(d) {
			body += d;
		});
		res.on('end', function() {
		});
	})
}

function sendNote() {
	checkOnline(function(success) {
		if (!success) {
			return;
		}
		if (message_type == 'smm') {
			var msgNumber = Math.floor(Math.random()*smm_messages.length);
			bot.say(channel, smm_messages[msgNumber]);
		} else {
			var msgNumber = Math.floor(Math.random()*other_messages.length);
			bot.say(channel, other_messages[msgNumber]);
		}
	})
}

module.exports = {
	set_db: function(database) {
		db = database;
	},
	socket_connect: function() {
		var uri = process.env.SOCKET_URI || "http://localhost:3000";
		var port = process.env.PORT || 3000;
		var end_url = uri+'/stream';
		var end_song_url = uri+'/song';
		console.log("End Url:"+end_url);
		client = client.connect(end_url);
		client.on('connect',function()
		{	
		});
		client.on('msg', function(message) {
			console.log('In Bot:'+message);
		});
		song_client = song_client.connect(end_song_url);
		song_client.on('connect',function()
		{	
		});
		song_client.on('res', function(success, user, msg) {
			if (success) {
				decPoints(user, 1);
			}
			bot.say(channel,'@'+user+' '+msg);
		});
		song_client.on('current_song', function(song) {
			bot.say(channel,'Current Song: '+song);
		})
	}
}
