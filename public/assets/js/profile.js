$(document).ready(function() {
	$('#collectionQuery').on('keyup', function(event){
		event.preventDefault();
		$.ajax('/api/user/' + $('.profile-title').text() + '/search', {
			type: 'POST',
			data: { 
				query: $('#collectionQuery').val().trim()
			}
		}).then(function(data) {
			if(data) {
				$('#collection').empty();
				var albumHtml = '';
				for(var i = 0; i < data.user.Albums.length; i++) {
					var album = data.user.Albums[i];
					var artistsDisplay = '';
					for(var j = 0; j < album.Artists.length; j++) {
						artistsDisplay += album.Artists[j].artist_name;
						if (j < album.Artists.length - 1)
							artistsDisplay += ', ';
					}					
					// I hate this approach so much, but it's 1:30 in the morning and I can't think of a better way to do it right now.
					if(i === 0) {
						albumHtml += '<div class="row">';
					}
					albumHtml += '<div class="col-md-3">';
					albumHtml += '<div class="album-container">';
					albumHtml += '<img src="' + album.album_art + '" class="album-image img-fluid" />';
					albumHtml += '<div class="album-overlay">';
					albumHtml += '<div class="album-overlay-text">';
					albumHtml += data.extra.loggedIn ? '<a href="/album/' + album.id + '">' : '';
					albumHtml += '<h5 class="white">' + album.title + '</h5>';
					albumHtml += data.extra.loggedIn ? '</a>' : '';
					albumHtml += '<p>by ' + artistsDisplay + '</p>';
					albumHtml += data.extra.canEdit ? '<a href="/user/' + data.user.username + '/post/?albumId=' + album.id + '"><i class="fas fa-pencil-alt"></i> Write a Post</a>' : '';
					albumHtml += '</div>';
					albumHtml += '</div>';
					albumHtml += '</div>';
					albumHtml += '</div>';

					if (i === 3 || (i > 3 && i % 4 === 3) || i === data.user.Albums.length - 1) {
						albumHtml += '</div><br><div class="row">';
					}
				}
				$('#collection').html(albumHtml);
			}
		});
	});
});