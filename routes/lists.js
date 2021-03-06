var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var dbutils = require('../utils/dbutils');
var utils = require('../utils/utils');
var uid = require('mongodb').ObjectID;
var active = 'lists';


router.use(function(req,res,next){


	var token = req.cookies.token || req.body.token || req.query.token || req.headers['x-access-token'];
	if (token){
		jwt.verify(token, app.get('jwt_secret'), function(err, decoded) {      
		    if (err) {
		        return res.redirect('/users/');    
		    } else {
		        req.decoded = decoded;    
		        next();
		    }
		});
	}
	else{

		res.redirect('/users/login')
	}

});


router.get('/:list', function(req, res) {
	email = req.decoded.email;
	var db=req.db;
	var list_title = req.params.list;
	dbutils.db_find(db, 'lists', {"title":list_title}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				list = records[0];
				access_list = list.access;

				if (access_list.indexOf(email) >= 0){
					res.render('pages/list', {email: email,json: list, list: list_title, active: active, active_list: list_title});

				}
				else{
					res.send("You do not have access to this list.");
				}

			}
		}
	});

});

router.get('/:list/fix', function(req, res) {
	email = req.decoded.email;
	var db=req.db;
	var list_title = req.params.list;
	dbutils.db_find(db, 'lists', {"title":list_title}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				list = records[0];
				access_list = list.access;

				if (access_list.indexOf(email) >= 0){
					dbutils.db_upsert(db, 'user:'+email, {"type":"lists"}, {"list":list_title}, function(push_result){
						if (push_result.fail == true){
							
							res.send("Some failure occured.");
							//console.log("Error"+push_result.error)

						}
						else{
							res.redirect('/lists/');
						}
					});

				}
				else{
					res.send("You do not have access to this list.");
				}

			}
		}
	});

});

router.get('/:list/admin', function(req, res) {
	email = req.decoded.email;
	var db=req.db;
	var list_title = req.params.list;
	dbutils.db_find(db, 'lists', {"title":list_title}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				list = records[0];
				if (list.admin == email){
					res.render('pages/list_admin', {userlist: list.access, list: list_title, active: active});

				}
				else{
					res.send("You do not have access to this list.");
				}

			}
		}
	});

});




router.get('/request/user_lists',function(req,res){
	email = req.decoded.email;
	
	var db = req.db;

	dbutils.db_find(db, 'user:'+email, {"type":"lists"},function(find_result){
		if (find_result.fail == true){
			//Error finding list
			res.send({"request":"fail", "error":"Failed to find lists."});
		}
		else{
			if(find_result.records.length > 1){
				res.send({"request":"fail", "error":"Failed to find lists."});
			}
			else if (find_result.records.length == 0){
				data = {'type':'lists', 'list':[]}
				dbutils.db_insert(db, 'user:'+email, data, function (insert_result){

					if (find_result.fail == true){
						//Error adding list for user
						console.log("Error"+insert_result.error)
						res.send({"request":"fail", "error":"Failed to find lists."});
					}
					else{
						res.send({"request":"success", "list":[]})
					}

				
				});
			}
			else{
				list = find_result.records[0].list;
				res.send({'request':'success', "list":list});
			}
		}
	});
});

router.post('/request/add',function(req,res){
	email = req.decoded.email;
	var list=req.body.list;

	var title = req.body.title;
	var text = req.body.text;
	var db = req.db;
	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			console.log(records);
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (access_list.indexOf(email) >= 0){
					data = {title:title, text:text, checked:[email], id: new uid()}
					dbutils.db_push(db, 'lists', {"title":list}, {"content":data}, function(push_result){
					if (push_result.fail == true){
						//Error adding notelist for user
						res.send({"request":"fail", "error":"failed to add to list."});
						console.log("Error"+push_result.error)

					}
					else{
						console.log(data);
						res.send({"request":"success"});
						console.log("Push success");
					}
				});

				}
				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}

			}
		}
	});

});


router.post('/request/remove',function(req,res){
	email = req.decoded.email;
	var list = req.body.list;
	var id = req.body.id;
	var db=req.db;
	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (access_list.indexOf(email) >= 0){

					dbutils.db_pull(db, 'lists', {"title":list}, {"content":{id: new uid(id)}}, function(push_result){
						if (push_result.fail == true){
							//Error adding notelist for user
							res.send({"request":"fail", "error":"failed to Remove from list."});
							console.log("Error"+push_result.error)

						}
						else{

							res.send({"request":"success"});
						}
					});
				}
				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}
			}
		}
	});

});


router.post('/request/comment',function(req,res){
	email = req.decoded.email;
	var list = req.body.list;
	var id = req.body.id;
	var comment = req.body.comment;
	var db=req.db;
	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (access_list.indexOf(email) >= 0){

					var comment_to_add = {email: email, comment: comment, id: new uid() };
					console.log("Data: "+comment_to_add);
					console.log("id: "+id);
					dbutils.db_push(db, 'lists', {"title":list, "content.id":new uid(id)}, {"content.$.comments":comment_to_add}, function(push_result){
						if (push_result.fail == true){
							//Error adding notelist for user
							res.send({"request":"fail", "error":"failed to add to list."});
							console.log("Error"+push_result.error)

						}
						else{

							res.send({"request":"success"});
							console.log("Push success: "+JSON.stringify(push_result));
						}
					});
				}
				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}
			}
		}
	});

});

router.post('/request/approve',function(req,res){
	email = req.decoded.email;
	var list = req.body.list;
	var id = req.body.id;
	var db=req.db;
	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (access_list.indexOf(email) >= 0){

					dbutils.db_add(db, 'lists', {"title":list, "content.id":new uid(id)}, {"content.$.checked":email}, function(push_result){
						if (push_result.fail == true){
							//Error adding notelist for user
							res.send({"request":"fail", "error":"failed to add to list."});
							console.log("Error"+push_result.error)

						}
						else{

							res.send({"request":"success"});
							console.log("Push success");
						}
					});
				}
				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}
			}
		}
	});

});



router.post('/request/decline',function(req,res){
	email = req.decoded.email;
	var list = req.body.list;
	var id = req.body.id;
	var db=req.db;
	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (access_list.indexOf(email) >= 0){
					dbutils.db_pull(db, 'lists', {"title":list, "content.id":new uid(id)}, {"content.$.checked":email}, function(push_result){
						if (push_result.fail == true){
							//Error adding notelist for user
							res.send({"request":"fail", "error":"failed to add to list."});
							console.log("Error"+push_result.error)

						}
						else{

							res.send({"request":"success"});
							console.log("Push success");
						}
					});
				}

				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}

			}
		}
	});

});
router.post('/request/add_access',function(req,res){
	email = req.decoded.email;
	var list=req.body.list;
	var user_to_add = req.body.user;
	var db = req.db;

	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (records[0].admin == email){
					dbutils.db_upsert(db, 'user:'+user_to_add, {"type":"lists"}, {"list":list}, function(push_result){
						if (push_result.fail == true){
							//Error adding notelist for user
							//console.log("Error"+push_result.error)

						}
						else{
							//console.log("Push success");
						}
					});


					dbutils.db_push(db, 'lists', {"title":list}, {"access":user_to_add}, function(push_result){
					if (push_result.fail == true){
						//Error adding notelist for user
						res.send({"request":"fail", "error":"failed to add to list."});
						console.log("Error"+push_result.error)

					}
					else{

						res.send({"request":"success"});
						console.log("Push success");
					}
				});

				}
				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}

			}
		}
	});

});


router.post('/request/remove_access',function(req,res){
	email = req.decoded.email;
	var list=req.body.list;
	var user_to_add = req.body.user;
	var db = req.db;

	dbutils.db_find(db, 'lists', {"title":list}, function(set_result){
		if (set_result.fail == true){
			//Error changing note text
			console.log("Error"+set_result.error)
			res.send({"request":"fail", "error":"Failed to load list."});
		}
		else{
			records = set_result['records'];
			if (records.length != 1){
				res.send({"request":"fail", "error":"List does not exist."});
			}
			else{
				access_list = records[0].access;

				if (records[0].admin == email){
					dbutils.db_pull(db, 'lists', {"title":list}, {"access":user_to_add}, function(push_result){
					if (push_result.fail == true){
						//Error adding notelist for user
						res.send({"request":"fail", "error":"failed to add to list."});
						console.log("Error"+push_result.error)

					}
					else{

						res.send({"request":"success"});
						console.log("Push success");
					}
				});

				}
				else{
					res.send({"request":"fail", "error":"You do not have access to this list."});
				}

			}
		}
	});

});


router.post('/request/create',function(req,res){
	email = req.decoded.email;
	var title = req.body.title;
	var db = req.db;

	dbutils.db_find(db, 'lists', {"title":title},function(find_result){
		if (find_result.fail == true){
			//Error finding notelist
			res.send({"request":"fail", "error":"Failed to create list."});
		}
		else{
			if(find_result.records.length >= 1){
				res.send({"request":"fail", "error":"List with that name already exists."});
			}
			else {
				data = { 'title':title, 'admin':email, 'access':[email],'content':[]};
				dbutils.db_insert(db, 'lists', data, function (insert_result){

					if (find_result.fail == true){
						//Error adding notelist for user
						console.log("Error"+insert_result.error)
						res.send({"request":"fail", "error":"Failed to find list."});
					}
					else{
						res.send({"request":"success", 'msg':title+" created."})
					}

				
				});
				dbutils.db_push(db, 'user:'+email, {"type":"lists"}, {"list":title}, function(push_result){
					if (find_result.fail == true){
						//Error adding notelist for user
						console.log("Error"+push_result.error)

					}
					else{
						console.log("Push success");
					}
				});
			}

		}
	});
});

router.get('/', function(req, res) {
	email = req.decoded.email;
	res.render('pages/my_lists', {email: email, active: active});
});

module.exports = router;