var express = require('express');
var router = express.Router();
var models = require('../models');
var Sequelize = require('sequelize');
var auth = require('../lib/helpers');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var querystring = require('querystring');

// creates a new user
router.post('/user/register', function(req, res) {
	var hashedPassword = bcrypt.hashSync(req.body.password, 8);
	models.User.findOne({
		where: {
			$or: [
				{ username : { $eq: req.body.username } },
				{ email: { $eq: req.body.email} }
			]
		}
	}).then(function(user) {
		if (user) {
			if (user.email === req.body.email)
				return res.json({ error: 'email' });
			if (user.username === req.body.username)
				return res.json({ error: 'username' });
		} else {
			return models.User.create({ 
				username: req.body.username,
				password: hashedPassword,
				email: req.body.email
			});
		}
	}).then(function() {
		auth.handler(req, res, 'register');
	}).catch(function(err) {
		res.json(err);
	});
});

// updates a user's information
router.put('/user/:id', auth.validate, function(req, res) {
	if (req.userId !== req.params.id)
		return res.status(401).send('You aren\'t authorized to do this!');
	models.User.update({ 
		email: req.body.email,
		name: req.body.name,
		location: req.body.location,
		bio: req.body.bio
	}, {
		where: {
			id: req.params.id
		}
	}).then(function(user) {
		res.redirect(200, '/user/' + req.username);
	}).catch(function(err) {
		res.json(err);
	});
});

// adds an album to the current user's collection
router.post('/album/:userId/:albumId', auth.validate, function(req, res) {
	if(req.userId !== req.params.userId)
		res.redirect(401, '/login');
	models.UserAlbum.create({
		AlbumId: req.params.albumId,
		UserId: req.params.userId
	}).then(function(result) {
		var resultObj = {
			username: req.username
		};
		res.json(resultObj);
	}).catch(function(err) {
		res.json(err);
	});
});

// searches for albums in the current user's collection
router.post('/user/:id/search', auth.validate, function(req, res) {	
	var whereObj;
	if (req.body.type === 'title') {
		whereObj = {
			$or: [
				{ title : { $eq: req.body.query } },
				{ title : { like: req.body.query + ' %' } },
				{ title: { like: '% ' + req.body.query } },
				{ title: { like: '% ' + req.body.query + ' %' } }
			]
		};
	} else if (req.body.type === 'artist') {
		whereObj = {
			$or: [
				{ '$Albums.Artist.artist_name$' : { $eq: req.body.query } },
				{ '$Albums.Artist.artist_name$' : { like: req.body.query + ' %' } },
				{ '$Albums.Artist.artist_name$': { like: '% ' + req.body.query } },
				{ '$Albums.Artist.artist_name$': { like: '% ' + req.body.query + ' %' } }
			]
		};
	}

	models.User.findOne({
		where: {
			id: req.params.id
		},
		include: [{
			model: models.Album,
			where: whereObj,
			required: false,
			include: [{
				model: models.Artist,
				required: true,
			}, {
				model: models.Label,
				required: true
			}, {
				model: models.Genre,
				required: true
			}]
		}, {
			model: models.Post,
			required: false
		}]
	}).then(function(userData) {
		var userObj = {
			user: userData
		};
		res.render('user', userObj);
	}).catch(function(err) {
		res.json(err);
	});
});

// creates a new post for the current user
router.post('/post/:userId/:albumId', auth.validate, function(req, res) {
	if (req.userId !== req.params.userId) {
		return res.redirect(401, '/login');
	}
	models.Post.create({ 
		body: req.body.body,
		isPublic: req.body.isPublic,
		UserId: req.params.userId,
		AlbumId: req.params.albumId
	}).then(function(post) {
		res.redirect(200, '/user/' + req.username);
	}).catch(function(err) {
		res.json(err);
	});
});

// updates a post for the current user
router.put('/post/:postId/:userId', auth.validate, function(req, res) {
	if (req.userId !== req.params.userId)
		return res.redirect(401, '/login');
	models.Post.update({ 
		body: req.body.body,
		isPublic: req.body.isPublic,
	}, {
		where: {
			id: req.params.id
		}
	}).then(function(post) {
		res.redirect(200, '/user/' + req.username);
	}).catch(function(err) {
		res.json(err);
	});
});

// deletes a post
router.delete('/post/:userId/:postId', auth.validate, function(req, res) {
	if (req.userId !== req.params.userId)
		return res.redirect(401, '/login');
	models.Post.destroy({
		where: {
			id: req.params.postId,
		}
	}).then(function(result) {
		res.status(200).end();
	}).catch(function(err) {
		res.json(err);
	});
});

module.exports = router;