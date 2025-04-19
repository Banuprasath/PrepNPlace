export default function PageNotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-5  `0 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4">
        <div className="relative">
          <h1 className="text-9xl font-extrabold text-gray-900 dark:text-gray-100">
            404
          </h1>
          <div className="absolute -top-4 -right-4 bg-red-500 rounded-full w-12 h-12 flex items-center justify-center border-4 border-white dark:border-gray-800">
            <span className="text-white text-xl">!</span>
          </div>
        </div>

        <h2 className="mt-6 text-2xl font-bold text-gray-800 dark:text-gray-200">
          PAGE NOT FOUND
        </h2>
        <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
          Sorry, we couldn't find the page you're looking for.
        </p>

        <button className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-300">
          Go Home
        </button>
      </div>
    </div>
  );
}
