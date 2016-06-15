'use strict';

define(['angular'], function(angular) {
  angular.module('patavi', []).service('PataviService', ['$q', '$http', function($q, $http) {
    // uriOrPromise: websocket URI or a promise resolving to a websocket URI
    // returns: a promise for the task results, which also sends notifications
    var listenForUpdates = function(uriOrPromise) {
      var uriPromise = uriOrPromise.then ? uriOrPromise : $q(function(resolve) {
        resolve(uriOrPromise);
      });

      var resultsPromise = $q.defer();

      function getResults(url, done) {
        $http.get(url).then(function(response) {
          done(response.data);
        });
      }

      // send a one time 'warm-up request to wws server as a workaround for chrome bug'
      // see https://bugs.chromium.org/p/chromium/issues/detail?id=329884 for details
      function warmup(uri) {
        return $http({
          method: 'GET',
          url: uri.replace('wss', 'https') + '/warm-up'
        });
      }

      uriPromise.then(function(uri) {
        warmup(uri).finally(function() {
          var socket = new WebSocket(uri);
          socket.onmessage = function(event) {
            var data = JSON.parse(event.data);
            if (data.eventType === 'done') {
              socket.close();
              getResults(data.eventData.href, resultsPromise.resolve);
            } else if (data.evenType === 'failed') {
              socket.close();
              getResults(data.eventData.href, resultsPromise.reject);
            }
            resultsPromise.notify(data);
          };
        });
      }, function(error) {
        resultsPromise.reject({
          'status': 'error',
          'error': error
        });
      });

      return resultsPromise.promise;
    };

    return {
      listen: listenForUpdates
    };
  }]);
});
