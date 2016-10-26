//Libraries
var express = require('express');
var request = require('request');
var helpers = require('express-helpers');
var async = require('async');
const url = require('url');
const querystring = require('querystring');

//Global Variables
var app = express();
var tempResultSet = new Array();
var tempSearchSet = new Array();
helpers(app);
const APIKEY = "GET IT ON https://developer.nytimes.com/";

//Settings
app.set('view engine', 'ejs');
app.set('port', (process.env.PORT || 8000));
app.set('views', __dirname + '/views');
app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});
app.use('/static', express.static(__dirname + '/static'));

//Router
app.get('/', function(req, res) {
    res.render('pages/index');
});

app.get('/about', function(req, res) {
	res.render('pages/about');
});

app.get('/pdf', function(req, res) {
	var query = url.parse(req.url).query;
	var fs = require('fs');
	var cheerio = require('cheerio');
	if (query == null) res.redirect('/404');
	else {
		//Get pdf
		var pdfUrl = querystring.parse(query).url;
		// console.log(pdfUrl);
		request(pdfUrl, function (error, response, body) {
		  var $ = cheerio.load(body);
		  var url = $('iframe#archivePDF').attr('src');
			//This is so fucking cool
			request(url).pipe(res);
		});
	}
});

app.get('/search', function(req, res) {
	var query = url.parse(req.url).query;
	var ifWrongInput = false;
	if (query == null) {
		res.render('pages/search', {
			ifWrongInput: ifWrongInput
		});
	} else {
		//Has query
		var text = querystring.parse(query).text;
		var bdate = querystring.parse(query).bdate;
		var edate = querystring.parse(query).edate;
		var sort = querystring.parse(query).sort;
		var page = querystring.parse(query).page;

		//Detect page offset;
		if (page == undefined) page = 0;

		function isDateValid(date) {
			var isValid = true;
			if (date == '') return true;
			if (date.length != 8) isValid = false;
			else {
				for (var i=0; i<8; i++) {
					if (!(date[i]>=0&&date[i]<=9)) {
						isValid = false;
						break;
					}
				}
			}
			return isValid;
		}

		function ifRequestLegal(text, bdate, edate, sort, page) {
			var isLegal = false;
			if (text == '') return false;
			if (isNaN(page) || Number(page) < 0) return false;
			if (isDateValid(bdate)&&isDateValid(edate)&&(sort=='relevant'||sort=='newest'||sort=='oldest')) {
				isLegal = true;
			}
			return isLegal;
		}

		if (ifRequestLegal(text, bdate, edate, sort, page)) {
			//Do stuff
			//Call API
			//Query without page
			var nowQuery = '?text=' + text + '&bdate=' + bdate + '&edate=' + edate + '&sort=' + sort;
			callArticleSearchAPI(text, bdate, edate, page, sort, function(data, sta) {
				if (sta == 'OK') {
					var entries = [];
					var ifNextPageExists = true;
					// console.log('Callback OK');
					// console.log(data);
					if (data.response.docs.length < 10) ifNextPageExists = false;
					for (var i = 0; i < data.response.docs.length; i++) {
						//Process result to conform popular response format
						var t = {};
						var keywords = '';
						//Deal with no byline
						if (data.response.docs[i].byline != null) t.byline = data.response.docs[i].byline.original;
						else t.byline = 'Anonymous'

						//Deal with no section
						if (data.response.docs[i].section != null) t.section = data.response.docs[i].news_desk;
						else t.section = 'all-sections'

						//Deal with type
						if (data.response.docs[i].document_type == 'article') t.type = 'Article';
						else t.type = 'non-article';

						//Normal data
						t.title = data.response.docs[i].headline.main;
						t.url = data.response.docs[i].web_url;
						t.published_date = data.response.docs[i].pub_date;
						t.source = data.response.docs[i].source;
						t.lead_paragraph = data.response.docs[i].lead_paragraph;
						t.id = data.response.docs[i]._id;

						//Make out keywords
						for (var j = 0; j < data.response.docs[i].keywords.length; j++) {
							keywords = keywords + data.response.docs[i].keywords[j].value + ';';
						}
						t.adx_keywords = keywords;

						//Push back
						entries.push(t);
						tempResultSet.push(t);
					}

					//Render search result page
					res.render('pages/searchResult', {
						text: text,
						sort: sort,
						entries: entries,
						page: Number(page),
						nextpage: ifNextPageExists,
						'query': nowQuery
					});

				} else {
					//Status == ERROR or response err
					res.render('pages/500');
				}

			});

		} else {
			//Wrong input
			ifWrongInput = true;
			res.render('pages/search', {
				ifWrongInput: ifWrongInput
			})
		}
	}

});

app.get('/article', function(req, res) {
  var query = url.parse(req.url).query;
	if (query == null) {
		res.redirect('/');
	} else {
		//Has query;
		var id = querystring.parse(query).id;
		// console.log(id);
		var result;
		var ifFound = false;
		if (tempResultSet.length > 0) {
			for (var i = 0; i < tempResultSet.length; i++) {
				result = tempResultSet[i];
				// console.log(result);
				if (result.id == id) {
					ifFound = true;
					break;
				}
			}
			if (ifFound == true) {
				//Start loading this article
				loadArticle(result, res);

			} else {
				console.log('Article id not found.');
				res.redirect('/404');
			}
		} else {
			console.log('tempResultSet empty');
			res.redirect('/404');
		}
	}

});

app.get('/read', function(req, res) {
	var query = url.parse(req.url).query;
	// console.log(query);
  if (query != null) {
  	var type = querystring.parse(query).type;
  	var section = querystring.parse(query).section;
  	var period = querystring.parse(query).period;
		var offset = querystring.parse(query).offset;
		if (offset == undefined) offset = '0';
		// console.log(offset);
  	// console.log(type);
  	// console.log(section);
  	// console.log(period);
  	//Check if in array function
  	function ifInArray(sth, arr) {
    	var ifIn = false;
    	for (var i = 0; i < arr.length; i++){
      	if (sth == arr[i]) {
        	ifIn = true;
        	break;
      	}
    	}
    	return ifIn;
  	}

    //Check if url legal function
  	function ifRequestLegal(type, section, period, offset) {
    	const tp = ["mostemailed", "mostshared", "mostviewed"];
    	const st = ["Arts", "Automobiles", "Blogs", "Books", "Business Day", "Education", "Fashion & Style", "Food", "Health", "Job Market", "Magazine", "membercenter", "Movies", "Multimedia", "N.Y. / Region", "NYT Now", "Obituaries", "Open", "Opinion", "Public Editor", "Real Estate", "Science", "Sports", "Style", "Sunday Review", "T Magazine", "Technology", "The Upshot", "Theater", "Times Insider", "Today’s Paper", "Travel", "U.S.", "World", "Your Money", "all-sections"];
    	const pd = ["1", "7", "30"];
			var ifOffsetLegal = false;
			if (offset % 20 == 0) ifOffsetLegal = true;
    	if (ifInArray(type, tp)&&ifInArray(section, st)&&ifInArray(period, pd)&&ifOffsetLegal == true) return true;
    	else return false;
  	}

  	if (ifRequestLegal(type, section, period, offset) == true) {
    	callPopularAPI(type, section, period, offset, function(data, sta){
      	// console.log('Callback OK');
				if (sta == 'OK') {
					var entries = [];
					var articleEntries = [];
					var interactiveEntries = [];
	      	var a1, a2;
					var ifNextPageExists = true;
					if (data.results.length < 20) ifNextPageExists = false;
	      	switch (type) {
	        	case 'mostshared':
	          	a1 = 'Most Shared';
	          	break;
	        	case 'mostviewed':
	          	a1 = 'Most Viewed';
	          	break;
	        	case 'mostemailed':
	          	a1 = "Most Emailed";
	          	break;
	      	}
	      	switch (period) {
	        	case '1':
	          	a2 = "day";
	          	break;
	        	case '7':
	          	a2 = "week";
	          	break;
	        	case '30':
	          	a2 = "month";
	        		break;
	      	}
	      	for (var i = 0; i < data.results.length; i++) {
	        	entries.push(data.results[i]);
	      	}
					//Give current data to global
					for (var i = 0; i < entries.length; i++) {
						tempResultSet.push(entries[i]);
						if (entries[i].type == 'Article') {
							articleEntries.push(entries[i]);
						} else if (entries[i].type == 'Interactive') {
							interactiveEntries.push(entries[i]);
						}
					}

	      	res.render('pages/read', {
	        	type: a1,
	        	section: section,
	        	period: a2,
						offset: offset/20+1,
						nextpage: ifNextPageExists,
						t: type,
						p: period,
	        	artEntry: articleEntries,
						interEntry: interactiveEntries
	      	});
				} else {
					res.render('pages/500');
				}

    	});
  	} else {
    	//Illegal request
    	res.redirect('/404');
  	}
	} else {
    //query = null directs to default
		res.redirect('?type=mostviewed&section=all-sections&period=1&offset=0');
	}
});

app.get('/404', function(req, res) {
	res.render('pages/404');
});

app.use(function(req, res, next) {
  res.status(404).redirect('/404');
});

//Call most popular API
function callPopularAPI(type, section, period, offset, callback){
  var requestURL = "https://api.nytimes.com/svc/mostpopular/v2/";
  requestURL = requestURL + type + '/' + querystring.escape(section) + '/' + period + ".json?offset=" + offset;
  request.get({
  	url: requestURL,
  	qs: {
      	'api-key': APIKEY
    	},
  }, function(err, response, body) {
		var responseStatus = 'OK';
		dataRetrieved = JSON.parse(body);
		// if (err) throw err;
		if ( err || (dataRetrieved.status != 'OK')) {
			console.log(dataRetrieved.status);
			responseStatus = 'BAD';
			callback(dataRetrieved, responseStatus);
		} else {
			console.log('Data retrieved.');
			// console.log(dataRetrieved.status);
	    if (typeof(callback) === "function") callback(dataRetrieved, responseStatus);
		}
  });
}

//Call article search API
function callArticleSearchAPI(text, bdate, edate, page, sort, callback) {
	var requestURL = 'https://api.nytimes.com/svc/search/v2/articlesearch.json';
	var getContent = {};
	getContent.url = requestURL;
	getContent.qs = {};
	getContent.qs['api-key'] = APIKEY;
	getContent.qs.q = text;
	getContent.qs.fl = "web_url,headline,lead_paragraph,source,keywords,pub_date,document_type,byline,_id,news_desk";
	getContent.qs.page = page;
	if (bdate != '') getContent.qs.begin_date = bdate;
	if (edate != '') getContent.qs.end_date = edate;
	if (sort == 'newest' || sort == 'oldest') getContent.qs.sort = sort;

	//Make request
	request.get(getContent, function(err, response, body) {
		var responseStatus = 'OK';
		dataRetrieved = JSON.parse(body);
		// if (err) throw err;
		if ( err || (dataRetrieved.status != 'OK')) {
			console.log(dataRetrieved.status);
			console.log(dataRetrieved.errors);
			responseStatus = 'BAD';
		} else {
			console.log('Data retrieved.');
			// console.log(dataRetrieved.status);
		}
		callback(dataRetrieved, responseStatus);
	});
}

//Load normal article with url
function loadArticle(result, res) {
	// Screen capture
	var phantom = require('phantom');
	var sitepage = null;
	var phInstance = null;
	if (result.type == 'Article') {
		phantom.create()
		  .then(instance => {
		      phInstance = instance;
		      return instance.createPage();
		  })
		  .then(page => {
		      sitepage = page;
		      return page.open(result.url);
		  })
		  .then(status => {
		      console.log(status);
		      return sitepage.property('content');
		  })
		  .then(content => {
					parseHtml(content, result, res);
		      sitepage.close();
		      phInstance.exit();
		  })
		  .catch(error => {
		      console.log(error);
		      phInstance.exit();
		});
	} else if (result.type == 'Interactive') {
		//Render screenshot
		res.render('pages/1000', {
			url: result.url
		});
		// phantom.create().then(function(ph) {
		//     ph.createPage().then(function(page) {
		//         // use page
		//         page.open(result.url);
		//         page.render('temp.png');
		// 				res.render('pages/article', {
		// 					title: result.title
		// 				});
		//         ph.exit();
		//     });
		// }).catch(error => {
		// 		console.log(error);
		// 		ph.exit();
		// 	});
	} else {
		//non-article
		res.render('pages/1000', {
			url: result.url
		});
	}
}

//parse data
function parseHtml(html, result, res) {
	var cheerio = require('cheerio');
	var $ = cheerio.load(html);
	var passage = new Array();
	var year = result.published_date.slice(0,4);
	var readable = true;
	var isPDF = false;
	var PDF = '';
	if (year >= 1851 && year <= 1922) {
		//PDF
		isPDF = true;
		PDF = $('a', 'span.downloadPDF').attr('href');
		var url = '../pdf?url=' + querystring.escape(PDF);
	} else if (year <= 1980) {
		//Not free
		readable = false;
	} else {
		//Present article
		$('p.story-content').map(function(i, el) {
			passage.push($(this).text());
		});
	}

	res.render('pages/article', {
		readable: readable,
		isPDF: isPDF,
		originalURL: PDF,
		cachedURL: url,
		passage: passage,
		title: result.title,
		url: result.url,
		keywords: result.adx_keywords,
		section: result.section,
		byline: result.byline,
		date: result.published_date,
		source: result.source
	});
}
