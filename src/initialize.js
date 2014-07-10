/*global _, db, angular */

var _cache, _config, _utils, _debounce, CONST;

// When caching is enabled, this variable stores references to queries to limit how fast a call can occur
_debounce = {};

/** Define the ngSharePoint module and SharePoint service
 *
 * An optional SP_CONFIG variable can be set to pass configuration options to the service:
 *
 *
 */
angular

	.module('ngSharePoint', [])

	.factory('SharePoint',

             ['$http',
              'SP_CONFIG',

              function ($http, SP_CONFIG) {

	              configuration(SP_CONFIG);

	              cache();

	              return main.apply(this, arguments);

              }
             ]);
