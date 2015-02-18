App = Ember.Application.create();

// Models
//App.user = DS.Model.extend() {
//  name
//}

// AUTHORIZATION HEADERS
App.AuthorizationAdapter = DS.RESTAdapter.extend({
  host: 'http://ec2-54-191-202-160.us-west-2.compute.amazonaws.com/',
  headers: function(){
    return {'AUTHORIZATION': "Token "+ $.cookie('token')}
  }.property().volatile(),

  buildURL: function() {
    var normalURL = this._super.apply(this, arguments);
    // Django adds '/' to urls if it doesn't have one. It will break CORS
    return normalURL + '/';
  },
  updateRecord: function(store, type, record) {
    var get = Ember.get;
    var data = {};
    var model_type = type.typeKey;
    var serializer = store.serializerFor(model_type);

    serializer.serializeIntoHash(data, type, record);
    var id = get(record, 'id');
    // Send the root data without the models name back to django
    return this.ajax(this.buildURL(model_type, id, record), "PUT", { data: data[model_type] });
  },
  createRecord: function(store, type, record) {
    var data = {};
    var model_type = type.typeKey
    var serializer = store.serializerFor(model_type);

    serializer.serializeIntoHash(data, type, record, { includeId: true });

    return this.ajax(this.buildURL(model_type, null, record), "POST", { data: data[model_type] });
  },
  actions: {
    error: function(reason, transition) {

      if (reason.status === 401) {
        this.redirect_to_login(transition);
      }else{
        console.log(reason, transition);
        //alert('something went wrong');
      }
    }
  }
});

// Routes
App.Router.map(function() {
  this.route('login');
});

App.LoginRoute = Ember.Route.extend({
  setupController: function(controller, context) {
    controller.reset();
  }
});

//App.IndexRoute = App.AuthenticatedRoute.extend();

App.AuthenticatedRoute = Ember.Route.extend({
  beforeModel: function(transition) {
    if (!this.controllerFor('login').get('token')) {
      this.redirect_to_login(transition)
    }
  },
  redirect_to_login: function(transition) {
    var loginController = this.controllerFor('login');
    loginController.set('attemptedTransition', transition);
    this.transitionTo('login');
  },
  actions: {
    error: function(reason, transition) {

      if (reason.status === 401) {
        this.redirect_to_login(transition);
      }else{
        console.log(reason, transition);
        //alert('something went wrong');
      }
    }
  }
});

App.IndexRoute = App.AuthenticatedRoute.extend({
  model: function() {
    return ['red', 'yellow', 'blue'];
  }
});


App.LoginController = Ember.Controller.extend({
  login_failed: false,
  isProcessing: false,
  is_slow_connection: false,
  error_message: null,
  timeout: null,

  token: $.cookie('token'),
  token_changed: function() {
    $.cookie('token', this.get('token'), { expires:.25, path: '/' });
  }.observes('token'),

  user_name: $.cookie('email'),
  user_name_changed: function() {
    $.cookie('email', this.get('email'), { expires:.25, path: '/' });
  }.observes('email'),

  actions: {
      login: function() {
          this.setProperties({
              login_failed: false,
              isProcessing: true
          });
          // Gather and post the authentication information
          this.set('email', this.get('username'));
          var data = this.getProperties('email', 'password');
          this.set("timeout", setTimeout(this.slowConnection.bind(this), 5000));
      var request = jQuery.post('http://ec2-54-191-202-160.us-west-2.compute.amazonaws.com/accounts/api-token-auth/', data);
      request.then(this.success.bind(this), this.failure.bind(this));
    }
  },

  success: function(response) {
    this.reset(),
        this.set('token', response.token);
    // Check to see if redirected from different route
    var attemptedTransition = this.get('attemptedTransition');
    if (attemptedTransition) {
      attemptedTransition.retry();
      this.set('attemptedTransition', null)
    }else {
      // Redirect to 'articles' by default
      this.transitionToRoute('index')
    }
  },

  failure: function(response) {
    this.set("user_name", null)
    this.reset();
    console.log('shit broke')
    // Detect the error type and response with appropriate message
    console.log(response);
    if (response.status === 400){
      this.set("error_message", 'Invalid username or password.');
    }else if (response.status === 0){
      this.set("error_message", 'Failed connecting to the server.');
    }else {
      this.set("error_message", 'Some kind of error occurred please try again later.');
    }
    this.set("login_failed", true);

  },

  slowConnection: function() {
    this.set("is_slow_connection", true);
  },

  reset: function() {
    clearTimeout(this.get("timeout"));
    this.setProperties({
      username: "",
      password: "",
      isProcessing: false,
      is_slow_connection: false
    })
  }
});