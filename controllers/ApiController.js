var express = require('express');
var router = express.Router();
var models = require('../models');
var gravatar = require('gravatar');
var bcrypt = require('bcrypt-nodejs');
var passport = require('../config/passport');
var passportAuth = require('../lib/passportAuth');
var helpers = require('../lib/helpers');

router.use(passport.initialize());
router.use(passport.session());

// updates a user's information
router.put('/user/:username/edit', passportAuth.ensureAuthenticated, function(req, res) {
	if (req.user.username !== req.params.username)
		return res.redirect('/');

	models.User.findOne({
		where: {
			username: req.params.username
		}
	}).then(function(user) {
		var passwordsMatch = user.validPassword(req.body.currentPassword);
		if (user && user.dataValues.username !== req.params.username) {
			res.json({ error: 'email in use' });
		}	
		if(req.body.currentPassword.length && req.body.newPassword.length && !passwordsMatch) {
			res.json({ error: 'bad password' });
		}
		var gravatarUrl = gravatar.url(req.body.email, {s: '200', r: 'pg', d: '404'}, true);
		return models.User.update({ 
			email: req.body.email,
			password: req.body.currentPassword.length ? bcrypt.hashSync(req.body.newPassword, bcrypt.genSaltSync(8), null) : user.dataValues.password,
			name: req.body.name,
			location: req.body.location,
			bio: req.body.bio,
			gravatarUrl: gravatarUrl
		}, {
			where: {
				username: req.params.username
			}
		});
	}).then(function(result) {
		res.json(result);
	}).catch(function(err) {
		res.json(err);
	});
});

// adds an album to the user's collection (and the database, if needed!)
router.post('/album/:userId/:albumId', passportAuth.ensureAuthenticated, function(req, res) {
	var albumData = req.body;
	var albumArtists = albumData['artists[]'];
	var albumLabels = albumData['labels[]'];
	var albumGenres = albumData['genres[]'];
	var albumStyles = albumData['styles[]'];

	// if we didn't get arrays for any of these, convert them to arrays
	var albumArtistsArray = helpers.convertToArray(albumArtists);
	var albumLabelsArray = helpers.convertToArray(albumLabels);
	var albumGenresArray = helpers.convertToArray(albumGenres);
	var albumStylesArray = helpers.convertToArray(albumStyles);

	models.User.findOne({
		where: {
			username: req.user.username
		}
	}).then(function(user) {
		if(user.dataValues.id !== req.params.userId || req.params.userId !== req.user.id)
			res.redirect('/');
		
		var albumId;
		var artistIds = [], 
			labelIds = [], 
			styleIds = [], 
			genreIds = [];

		models.sequelize.transaction(function (t) {
			var artistPromises = [];
			var artists = albumArtistsArray;
			for (var i = 0; i < artists.length; i++) {
				var artistPromise = models.Artist.findOrCreate({
					where: {
						artist_name: artists[i]
					},
					default: {
						artist_name: artists[i]
					},
					transaction: t
				});
				artistPromises.push(artistPromise);
			}
			return Promise.all(artistPromises).then(function(artists) {
				for (var i = 0; i < artists.length; i++) {
					artistIds.push(artists[i][0].id);
				}
				var labelPromises = [];
				var labels = albumLabelsArray;
				for (var i = 0; i < labels.length; i++) {
					var labelPromise =  models.Label.findOrCreate({
						where: {
							label_name: labels[i]
						},
						defaults: {
							label_name: labels[i]
						},
						transaction: t
					});
					labelPromises.push(labelPromise);
				}
				return Promise.all(labelPromises).then(function(labels) {
					for (var i = 0; i < labels.length; i++) {
						labelIds.push(labels[i][0].id);
					}
					var stylePromises = [];
					var styles = albumStylesArray;
					for (var i = 0; i < styles.length; i++) {
						var stylePromise = models.Style.findOrCreate({
							where: {
								style_name: styles[i]
							},
							defaults: {
								style_name: styles[i]
							},
							transaction: t
						});
						stylePromises.push(stylePromise);
					}
					return Promise.all(stylePromises).then(function(styles) {
						for (var i = 0; i < styles.length; i++) {
							styleIds.push(styles[i][0].id);
						}
						var genrePromises = [];
						var genres = albumGenresArray;
						for (var i = 0; i < genres.length; i++) {
							var genrePromise = models.Genre.findOrCreate({
								where: {
									genre_name: genres[i]
								},
								defaults: {
									genre_name: genres[i]
								},
								transaction: t
							});
							genrePromises.push(genrePromise);
						}
						return Promise.all(genrePromises).then(function(genres) {
							for (var i = 0; i < genres.length; i++) {
								genreIds.push(genres[i][0].id);
							}
							return models.Album.findOrCreate({
								where: {
									id: req.params.albumId
								},
								defaults: {
									id: req.params.albumId,
									title: req.body.title,
									album_art: req.body.album_art,
									release_year: req.body.year,
									added_by: req.params.userId
								},
								transaction: t
							}).then(function(album) {
								albumId = album[0].id;
								return models.UserAlbum.findOrCreate({
									where: {
										UserId: req.params.userId,
										AlbumId: albumId
									},
									defaults: {
										UserId: req.params.userId,
										AlbumId: albumId
									},
									transaction: t
								});
							}).then(function(result) {
								var albumGenrePromises = [];
								for (var i = 0; i < genreIds.length; i++) {
									var albumGenrePromise = models.AlbumGenre.findOrCreate({
										where: {
											AlbumId: albumId,
											GenreId: genreIds[i]
										},
										defaults: {
											AlbumId: albumId,
											GenreId: genreIds[i]
										},
										transaction: t
									});
									albumGenrePromises.push(albumGenrePromise);
								}
								return Promise.all(albumGenrePromises).then(function(albumGenres) {
									var albumStylePromises = [];
									for (var i = 0; i < styleIds.length; i++) {
										var albumStylePromise = models.AlbumStyle.findOrCreate({
											where: {
												AlbumId: albumId,
												StyleId: styleIds[i]
											},
											defaults: {
												AlbumId: albumId,
												StyleId: styleIds[i]
											},
											transaction: t
										});
										albumStylePromises.push(albumStylePromise);
									}
									return Promise.all(albumStylePromises).then(function(albumStyles) {
										var albumArtistPromises = [];
										for (var i = 0; i < artistIds.length; i++) {
											var albumArtistPromise = models.AlbumArtist.findOrCreate({
												where: {
													AlbumId: albumId,
													ArtistId: artistIds[i]
												},
												defaults: {
													AlbumId: albumId,
													ArtistId: artistIds[i]
												},
												transaction: t
											});
											albumArtistPromises.push(albumArtistPromise);
										}
										return Promise.all(albumArtistPromises).then(function(albumArtists) {
											var albumLabelPromises = [];
											for (var i = 0; i < labelIds.length; i++) {
												var albumLabelPromise = models.AlbumLabel.findOrCreate({
													where: {
														AlbumId: albumId,
														LabelId: labelIds[i]
													},
													defaults: {
														AlbumId: albumId,
														LabelId: labelIds[i]
													},
													transaction: t
												});
												albumLabelPromises.push(albumLabelPromise);
											}
											return Promise.all(albumLabelPromises);
										});
									});
								});
							});
						});
					});
				});
			});		
		}).then(function (result) {
			var resultObj = {
				success: true,
				status: 200
			};
			res.end(JSON.stringify(resultObj));
		}).catch(function (err) {
			res.json(err);
		});
	});
	
});

// searches for albums in the current user's collection
router.post('/user/:username/search', passportAuth.ensureAuthenticated, function(req, res) {	
	var whereObj;
	var canEdit = false;
	var loggedIn = false;
	if (req.user.username === req.params.username)
		canEdit = true;
	if (req.user.username)
		loggedIn = true;

	models.User.findOne({
		where: {
			username: req.params.username
		},
		include: [{
			model: models.Album,
			where: {
				$or: [
					{ title : { like: '%' + req.body.query + '%' } },
					{ '$Albums.Artists.artist_name$' : { $like: '%' + req.body.query + '%' } }
				]
			},
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
			}, {
				model: models.Style,
				required: true
			}]
		}, {
			model: models.Post,
			required: false
		}]
	}).then(function(userData) {
		var userObj = {
			user: userData,
			extra: {
				loggedIn: loggedIn,
				canEdit: canEdit
			}
		};
		res.json(userObj);
	}).catch(function(err) {
		res.json(err);
	});
});

// creates a new post for the current user
router.post('/post/:userId/:albumId', passportAuth.ensureAuthenticated, function(req, res) {
	if (req.user.id != req.params.userId) {
		return res.redirect('/login');
	}
	models.Post.create({ 
		body: req.body.body,
		isPublic: req.body.isPublic,
		UserId: req.params.userId,
		AlbumId: req.params.albumId
	}).then(function(post) {
		res.json(post);
	}).catch(function(err) {
		res.json(err);
	});
});

// updates a post for the current user
router.put('/post/:userId/:postId', passportAuth.ensureAuthenticated, function(req, res) {
	if (req.user.id != req.params.userId)
		return res.redirect('/login');
	models.Post.update({ 
		body: req.body.body,
		isPublic: req.body.isPublic,
	}, {
		where: {
			id: req.params.postId
		}
	}).then(function(post) {
		res.json(post);
	}).catch(function(err) {
		res.json(err);
	});
});

// deletes a post
router.delete('/post/:userId/:postId', passportAuth.ensureAuthenticated, function(req, res) {
	if (req.user.id != req.params.userId)
		return res.redirect('/login');
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