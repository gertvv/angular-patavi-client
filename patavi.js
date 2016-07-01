'use strict';

define(['angular'], function(angular) {
  angular.module('patavi', []).service('PataviService', ['$q', '$http', function($q, $http) {
    // uriOrPromise: Task URI or a promise resolving to a task URI
    // returns: a promise for the task results, which also sends notifications
    var listenForUpdates = function(uriOrPromise) {
      var taskPromise = uriOrPromise.then ? uriOrPromise : $q(function(resolve) { resolve(uriOrPromise); });

      var resultsPromise = $q.defer();

      function getResults(url, done) {
        $http.get(url).then(function(response) {
          done(response.data);
        });
      }

      function reportError(error) {
        resultsPromise.reject({ 'status': 'error', 'error': error });
      }

      taskPromise.then(function(taskUrl) {
        return $http.get(taskUrl);
      }, reportError).then(function(response) {
        if (!response.data || !response.data._links || !response.data._links.updates) {
          return resultsPromise.reject({ 'status': 'error', 'error': 'Patavi returned a malformed response' });
        }

        if (response.data._links.results) {
          if (response.data.status === "done") {
            return getResults(response.data._links.results.href, resultsPromise.resolve);
          } else {
            return getResults(response.data._links.results.href, resultsPromise.reject);
          }
        }

        var socket = new WebSocket(response.data._links.updates.href);
        socket.onmessage = function (event) {
          var data = JSON.parse(event.data);
          if (data.eventType === "done") {
            socket.close();
            getResults(data.eventData.href, resultsPromise.resolve);
          } else if (data.eventType === "failed") {
            socket.close();
            getResults(data.eventData.href, resultsPromise.reject);
          }
          resultsPromise.notify(data);
        }
      }, reportError);

      return resultsPromise.promise;
    };

    return {
      listen: listenForUpdates
    };
  }]);
});
