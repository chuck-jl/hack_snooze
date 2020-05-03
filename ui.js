$(async function() {
	// cache some selectors we'll be using quite a bit
	const $allStoriesList = $('#all-articles-list');
	const $loginForm = $('#login-form');
	const $createAccountForm = $('#create-account-form');
	const $ownStories = $('#my-articles');
	const $navLogin = $('#nav-login');
	const $navLogOut = $('#nav-logout');

	// global storyList variable
	let storyList = null;

	// global currentUser variable
	let currentUser = null;

	await checkIfLoggedIn();

	/**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */
	$('#login').on('click', function() {
		$loginForm.submit();
	});

	$loginForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit
		// grab the username and password
		const username = $('#login-username').val();
		const password = $('#login-password').val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
		console.log(currentUser.password);
		syncCurrentUserToLocalStorage();
		UpdateUserPanelForLoggedInUser(currentUser);
		generateCreatedStories(currentUser);
		generateFavoriteStories(currentUser);
		loginAndSubmitForm();
		highlightFavorites(currentUser);
		enableFavoriteClick();
		enableRemoveClick();
	});

	/**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */
	$('#createNew').on('click', function() {
		$createAccountForm.submit();
	});

	$createAccountForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page refresh

		// grab the required fields
		let name = $('#create-account-name').val();
		let username = $('#create-account-username').val();
		let password = $('#create-account-password').val();

		// call the create method, which calls the API and then builds a new user instance
		const newUser = await User.create(username, password, name);
		currentUser = newUser;
		syncCurrentUserToLocalStorage();
		UpdateUserPanelForLoggedInUser(currentUser);
		loginAndSubmitForm();
		enableFavoriteClick();
	});

	/**
   * Log Out Functionality
   */

	$navLogOut.on('click', function() {
		// empty out local storage
		localStorage.clear();
		// refresh the page, clearing memory
		location.reload();
	});

	/**
   * Event Handler for Clicking my own story
  */
	$('#nav-my-stories').on('click', function() {
		$allStoriesList.hide();
		$ownStories.show();
		$('#favorited-articles').hide();
	});

	/**
   * Event Handler for Clicking my favorite story
  */
	$('#nav-favorites').on('click', function() {
		$allStoriesList.hide();
		$ownStories.hide();
		$('#favorited-articles').show();
	});

	/**
   * Event handler for Navigation to Homepage
   */

	$('#nav-all, #nav-home').on('click', async function() {
		hideElements();
		await generateStories();
		$allStoriesList.show();
		if (currentUser) {
			highlightFavorites(currentUser);
		}
	});

	/**
   * Function maintain Event handler for toggling favorite icon
   */
	function enableFavoriteClick() {
		$('.articles-container').on('click', '.fa-star', async function() {
			const storyId = $(this).parent().attr('id');
			const token = localStorage.getItem('token');
			const username = localStorage.getItem('username');
			if ($(this).hasClass('fas')) {
				$(this).toggleClass('fas').toggleClass('far');
				currentUser = await User.removeFavoriteStory(token, username, storyId);
				await generateStories();
				if (currentUser) {
					syncCurrentUserToLocalStorage();
					generateFavoriteStories(currentUser);
					highlightFavorites(currentUser);
				}
			} else if ($(this).hasClass('far')) {
				$(this).toggleClass('far').toggleClass('fas');
				currentUser = await User.addFavoriteStory(token, username, storyId);
				await generateStories();
				if (currentUser) {
					syncCurrentUserToLocalStorage();
					generateFavoriteStories(currentUser);
					highlightFavorites(currentUser);
				}
			}
		});
	}

	/**
   * Function maintain Event handler for toggling favorite icon
   */
	function enableRemoveClick() {
		$('.articles-container').on('click', '.fa-trash-alt', async function() {
			const storyId = $(this).parent().attr('id');
			await removeStory(storyId);
			currentUser = await User.getLoggedInUser(currentUser.loginToken, currentUser.username);
			await generateStories();
			if (currentUser) {
				generateCreatedStories(currentUser);
				generateFavoriteStories(currentUser);
			}
		});
	}

	/**
   * Function hightlight the favorite icons for favorite stories after login
   */
	function highlightFavorites(user) {
		const favoritesArray = user.favorites;
		if (favoritesArray.length != 0) {
			for (let story of favoritesArray) {
				const storyId = story.storyId;
				$(`#all-articles-list #${storyId} i`).removeClass('far').addClass('fas');
				$(`#favorited-articles #${storyId} i`).removeClass('far').addClass('fas');
				$(`#my-articles #${storyId} i`).removeClass('far').addClass('fas');
			}
		}
	}

	/**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

	async function checkIfLoggedIn() {
		// let's see if we're logged in
		const token = localStorage.getItem('token');
		const username = localStorage.getItem('username');

		// if there is a token in localStorage, call User.getLoggedInUser
		//  to get an instance of User with the right details
		//  this is designed to run once, on page load
		currentUser = await User.getLoggedInUser(token, username);
		await generateStories();

		if (currentUser) {
			
			UpdateUserPanelForLoggedInUser(currentUser);
			generateCreatedStories(currentUser);
			generateFavoriteStories(currentUser);
			showNavForLoggedInUser();
			enableFavoriteClick();
			highlightFavorites(currentUser);
			enableRemoveClick();
		}
	}

	/**
   * On new story submit, post new story request and get User info again.
   * Renders my story article information accordingly.
   */

	async function addNewStory(newStory) {
		const token = localStorage.getItem('token');

		await StoryList.addStory(token, newStory);

		await generateStories();
	}

	/**
   * On story delete event, remove story and get User info again.
   * Renders my story article information accordingly.
   */

	async function removeStory(storyId) {
		const token = localStorage.getItem('token');

		await StoryList.deleteStory(token, storyId);

		await generateStories();
	}

	/**
   * Click button in the modal footer to trigger new story submit event handler.
   */
	$('#submitNewStory').on('click', function() {
		$('#submit-form').submit();
	});

	/**
   * On new story submit event handler.
   * Renders my story article information accordingly.
   */

	$('#submit-form').on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the elements for new story;
		const newStory = {};
		newStory.author = $('#author').val();
		newStory.title = $('#title').val();
		newStory.url = $('#url').val();

		await addNewStory(newStory);

		const token = localStorage.getItem('token');
		const username = localStorage.getItem('username');

		currentUser = await User.getLoggedInUser(token, username);

		syncCurrentUserToLocalStorage();
		generateCreatedStories(currentUser);

		$('#submit-form').trigger('reset');
	});

	/**
   * A rendering function to run to reset the forms and hide the login info
   */

	function loginAndSubmitForm() {
		// reset those forms
		$loginForm.trigger('reset');
		$createAccountForm.trigger('reset');

		// show the stories
		$allStoriesList.show();

		// update the navigation bar
		showNavForLoggedInUser();
	}

	/**
   * Adjust the welcome panel and fill in User profile info,
   */
	function UpdateUserPanelForLoggedInUser(user) {
		$('#nav-user-profile').text(user.name);
		$('#profile-name').text(`${user.name}`);
		$('#profile-username').text(`${user.username}`);
		$('#profile-account-date').text(`${user.createdAt}`);
	}

	/**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

	async function generateStories() {
		// get an instance of StoryList
		const storyListInstance = await StoryList.getStories();
		// update our global variable
		storyList = storyListInstance;
		// empty out that part of the page
		$allStoriesList.empty();

		// loop through all of our stories and generate HTML for them
		for (let story of storyList.stories) {
			const result = generateStoryHTML(story);
			$allStoriesList.append(result);
		}
	}

	/**
   * A rendering function to generate created stories by currentUser
   */

	function generateCreatedStories(user) {
		// empty out that part of the page
		$ownStories.empty();
		// loop through all of our own stories and generate HTML for them
		if (user.ownStories.length === 0) {
			$ownStories.html('<b>No story created yet!</b>');
		} else {
			for (let story of user.ownStories) {
				const result = generateStoryHTML(story);
				result.prepend($('<i class="fas fa-trash-alt"></i>'));
				result.append(
					$(
						'<button class="btn btn-primary btn-sm" data-toggle="modal" data-target="#editStoryModal">Edit</button>'
					)
				);
				$ownStories.append(result);
			}
		}
	}

	/**
   * A rendering function to generate created stories by currentUser
   */

	function generateFavoriteStories(user) {
		// empty out that part of the page
		$('#favorited-articles').empty();
		// loop through all of our own stories and generate HTML for them
		if (user.favorites.length === 0) {
			$('#favorited-articles').html('<b>No favorites added!</b>');
		} else {
			for (let story of user.favorites) {
				const result = generateStoryHTML(story);
				$('#favorited-articles').append(result);
			}
		}
	}

	/**
   * A function to render HTML for an individual Story instance
   */

	function generateStoryHTML(story) {
		let hostName = getHostName(story.url);

		// render story markup
		const storyMarkup = $(`
      <li id="${story.storyId}" class="list-group-item">
        <i class="far fa-star"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
		</a>
		<br>
        <small class="article-author font-weight-light">by ${story.author}</small>
		<small class="article-hostname font-italic ${hostName}">(${hostName})</small>
		<br>
        <small class="article-username font-weight-light">posted by ${story.username}</small>
      </li>
    `);

		return storyMarkup;
	}

	/* hide all elements in elementsArr */

	function hideElements() {
		const elementsArr = [ $allStoriesList, $ownStories, $('#favorited-articles') ];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	/* show all elements in elementsArr */
	function showNavForLoggedInUser() {
		$navLogin.hide();
		const elementsArray = [
			$navLogOut,
			$('#nav-welcome'),
			$('#user-profile'),
			$('#nav-home-contianer'),
			$('#nav-dropdown-contianer'),
			$('#nav-my-stories-contianer'),
			$('#nav-favorites-contianer')
		];
		elementsArray.forEach(($elem) => $elem.show());
	}

	/* simple function to pull the hostname from a URL */

	function getHostName(url) {
		let hostName;
		if (url.indexOf('://') > -1) {
			hostName = url.split('/')[2];
		} else {
			hostName = url.split('/')[0];
		}
		if (hostName.slice(0, 4) === 'www.') {
			hostName = hostName.slice(4);
		}
		return hostName;
	}

	/* sync current user information to localStorage */

	function syncCurrentUserToLocalStorage() {
		if (currentUser) {
			localStorage.setItem('token', currentUser.loginToken);
			localStorage.setItem('username', currentUser.username);
		}
	}

	/* Event handler to customize edit modal when it pops up 
	*  Adding in the current information about the story to modal;
	*/

	$('#editStoryModal').on('show.bs.modal', function(event) {
		const button = $(event.relatedTarget); // Button that triggered the modal
		const storyId = button.parent().attr('id'); // Extract info from button parent
		let stories = currentUser.ownStories;

		let targetStory = stories.filter(function(story) {
			return story.storyId === storyId;
		});
		const modal = $(this);
		modal.find('.modal-body #edit-id').text(`Id: ${targetStory[0].storyId}`);
		modal.find('.modal-body #edit-author').val(targetStory[0].author);
		modal.find('.modal-body #edit-title').val(targetStory[0].title);
		modal.find('.modal-body #edit-url').val(targetStory[0].url);
	});

	/* Event handler to fill in customer information modal when it pops up 
	*  Adding in the current user info  to modal;
	*/

	$('#editUserInfoModal').on('show.bs.modal', function(event) {
		const modal = $(this);
		modal.find('.modal-body #update-name').val(currentUser.name);
	});

	/* add event listener for modal when ready to upload an edit on existing story*/
	$('#editStory').on('click', function() {
		$('#edit-article-form').submit();
	});

	/* Event listener for when edit story request is made, form submitted*/
	$('#edit-article-form').on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the elements for new story;
		const newStory = {};
		newStory.author = $('#edit-author').val();
		newStory.title = $('#edit-title').val();
		newStory.url = $('#edit-url').val();

		const storyId = $('#edit-id').text().split(' ')[1];

		await updateStory(newStory, storyId);

		const token = localStorage.getItem('token');
		const username = localStorage.getItem('username');

		currentUser = await User.getLoggedInUser(token, username);

		syncCurrentUserToLocalStorage();
		generateCreatedStories(currentUser);

		$('#edit-article-form').trigger('reset');
	});

	/**
   * On edit story submit, post changed story request and get User info again.
   * Renders my story article information accordingly.
   */

	async function updateStory(newStory, storyId) {
		const token = localStorage.getItem('token');

		await StoryList.updateStory(token, newStory, storyId);

		await generateStories();
	}

	/*Event for submitting updated user information*/
	$('#submitChangedUserInfo').on('click',function(){
		console.log("I am here.");
		$('#update-form').submit();
	})
	$('#update-form').on('submit',async function(evt){
		evt.preventDefault(); // no page-refresh on submit

		// grab the new elements for user;
		const newUser = {};
		newUser.name = $('#update-name').val();
		//if nothing in password, move on
		if($('#update-password').val()){
			newUser.password=$('#update-password').val();
		}
		//get token and username from currentUser
		const token= currentUser.loginToken;
		const username = currentUser.username;
		//send request
		currentUser = await User.updateUserInfo(token, username, newUser);
		//Sync with localstorage
		syncCurrentUserToLocalStorage();
		//Update user panel
		UpdateUserPanelForLoggedInUser(currentUser);
		$('#update-form').trigger('reset');
	})

	/*Event for deleting User*/
	$('#deleteAccount').on("click",async function(){
		const token = currentUser.loginToken;
		const username = currentUser.username;
		

		currentUser = await User.deleteUser(token, username);
		console.log(currentUser)
		//clear localstorage
		localStorage.clear();
		// refresh the page, clearing memory
		location.reload();
	})
});
