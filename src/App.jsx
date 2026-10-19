import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Course from './pages/Course.jsx'
import About from './pages/About.jsx'
import Progress from './pages/Progress.jsx'
import Admin from './pages/Admin.jsx'
import Contribute from './pages/Contribute.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="c/:id" element={<Course />} />
        <Route path="about" element={<About />} />
        <Route path="progress" element={<Progress />} />
        <Route path="contribute" element={<Contribute />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
