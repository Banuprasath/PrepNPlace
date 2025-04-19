import AppLayout from "./AppLayout"



function App() {

  return (
    <>
    <h1 className="text-3xl font-bold underline">Welcome </h1>
    <AppLayout>
      <section>
        <h1 className="text-2xl font-bold">Welcome to the Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Here's where you can manage your settings, view data, and more.
        </p>
      </section>
    </AppLayout>
 
    </>
  )
}

export default App
