function cache() {

	// If caching is enabled/available set it up
	if (!_config.noCache) {

		// Array to hold our callbacks while the cache DB is still loading, this will change to the cacheDB after init
		_cache = [];

		db

			// Initialize the service
			.open(
			{
				'server' : 'angularSharePoint',
				'version': 1,
				'schema' : {
					'caches': {
						'keyPath': 'q'
					}
				}
			})

			// Once the DB is loaded, try to run any cached callbacks and setup the cacheDB reference
			.done(function (instance) {

				      // Clone the _cache array to runners[]
				      var runners = _cache.slice(0);

				      // Remap _cache to instance (now acts as the cacheDB)
				      _cache = instance;

				      // Run all the callbacks async
				      while (runners.length) {

					      // Use shift() to reduce the array and pass a callback
					      setTimeout(runners.shift(), 25);

				      }

			      });

	}

}