require('dotenv').config();
var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var db = require('./models');

var app = express();
var PORT = process.env.PORT || 3000;

// Sets up the Express app to handle data parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use(express.static('public'));

// Import controllers
var RootController = require('./controllers/RootController');
app.use(RootController);

var ApiController = require('./controllers/ApiController');
app.use('/api', ApiController);

// Sync with DB and then listen
db.sequelize.sync().then(function() {
	app.listen(PORT, function() {
		console.log('Listening on port %s', PORT);
	});
});
