import { Routes, Route, Navigate } from 'react-router-dom'
import { ConsoleProvider } from './contexts/ConsoleContext'
import { VPSProvider } from './contexts/VPSContext'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage'
import ProjectsPage from './pages/ProjectsPage'
import NewProjectPage from './pages/NewProjectPage'
import EnvironmentPage from './pages/EnvironmentPage'
import SettingsPage from './pages/SettingsPage'
import SSHPage from './pages/SSHPage'
import PortsPage from './pages/PortsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import VPSDashboardPage from './pages/VPSDashboardPage'
import DocsPage from './pages/DocsPage'
import ToolboxPage from './pages/ToolboxPage'
import ApiTesterPage from './pages/ApiTesterPage'
import SnippetsPage from './pages/SnippetsPage'
import DiffPage from './pages/DiffPage'
import GeneratorPage from './pages/GeneratorPage'

export default function App() {
  return (
    <ConsoleProvider>
      <VPSProvider>
        <Layout>
          <Routes>
            <Route path="/"            element={<HomePage />} />
            <Route path="/projects"    element={<ProjectsPage />} />
            <Route path="/new-project" element={<NewProjectPage />} />
            <Route path="/ssh"         element={<SSHPage />} />
            <Route path="/environment" element={<EnvironmentPage />} />
            <Route path="/ports"       element={<PortsPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
            <Route path="/docs"        element={<DocsPage />} />
            <Route path="/project/:id" element={<ProjectDetailPage />} />
            <Route path="/vps/:connectionId" element={<VPSDashboardPage />} />
            <Route path="/toolbox"     element={<ToolboxPage />} />
            <Route path="/api-tester"  element={<ApiTesterPage />} />
            <Route path="/snippets"    element={<SnippetsPage />} />
            <Route path="/diff"        element={<DiffPage />} />
            <Route path="/generator"   element={<GeneratorPage />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </VPSProvider>
    </ConsoleProvider>
  )
}
