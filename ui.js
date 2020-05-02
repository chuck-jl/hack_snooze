$(async function() {
	// cache some selectors we'll be using quite a bit
	const $allStoriesList = $('#all-articles-list');
	const $submitForm = $('#submit-form');
	const $filteredArticles = $('#filtered-articles');
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

	$loginForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the username and password
		const username = $('#login-username').val();
		const password = $('#login-password').val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
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
   * Event Handler for Clicking Login
   */

	$navLogin.on('click', function() {
		// Show the Login and Create Account Forms
		$loginForm.slideToggle();
		$createAccountForm.slideToggle();
		$allStoriesList.toggle();
	});

	/**
   * Event Handler for Clicking new story
  */
	$('#nav-submit').on('click', function() {
		$('#submit-form').slideToggle();
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

	$('body').on('click', '#nav-all', async function() {
		hideElements();
		await generateStories();
		$allStoriesList.show();
		highlightFavorites(currentUser);
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
			if(currentUser){
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
			console.log(currentUser);
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
		// hide the forms for logging in and signing up
		$loginForm.hide();
		$createAccountForm.hide();

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
		$('#profile-name').text(`Name: ${user.name}`);
		$('#profile-username').text(`Username: ${user.username}`);
		$('#profile-account-date').text(`Account Created: ${user.createdAt}`);
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
		for (let story of user.ownStories) {
			const result = generateStoryHTML(story);
			result.prepend($('<i class="fas fa-trash-alt"></i>'));
			$ownStories.append(result);
		}
	}

	/**
   * A rendering function to generate created stories by currentUser
   */

	function generateFavoriteStories(user) {
		// empty out that part of the page
		$('#favorited-articles').empty();
		// loop through all of our own stories and generate HTML for them
		for (let story of user.favorites) {
			const result = generateStoryHTML(story);
			$('#favorited-articles').append(result);
		}
	}

	/**
   * A function to render HTML for an individual Story instance
   */

	function generateStoryHTML(story) {
		let hostName = getHostName(story.url);

		// render story markup
		const storyMarkup = $(`
      <li id="${story.storyId}">
        <i class="far fa-star"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

		return storyMarkup;
	}

	/* hide all elements in elementsArr */

	function hideElements() {
		const elementsArr = [
			$submitForm,
			$allStoriesList,
			$filteredArticles,
			$ownStories,
			$loginForm,
			$createAccountForm,
			$('#favorited-articles')
		];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	function showNavForLoggedInUser() {
		$navLogin.hide();
		$navLogOut.show();
		$('.main-nav-links').show();
		$('#nav-welcome').show();
		//Display User Panel
		$('#user-profile').show();
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
});
