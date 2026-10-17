import { Routes, Route, Navigate } from 'react-router-dom'
import { ConsoleProvider } from '@renderer/app/ConsoleContext'
import { VPSProvider } from '@renderer/features/ssh/VPSContext'
import Layout from '@renderer/components/layout/Layout'
import HomePage from '@renderer/features/home/HomePage'
import ProjectsPage from '@renderer/features/projects/ProjectsPage'
import NewProjectPage from '@renderer/features/projects/NewProjectPage'
import EnvironmentPage from '@renderer/features/system/EnvironmentPage'
import SettingsPage from '@renderer/features/settings/SettingsPage'
import SSHPage from '@renderer/features/ssh/SSHPage'
import PortsPage from '@renderer/features/system/PortsPage'
import ProjectDetailPage from '@renderer/features/projects/ProjectDetailPage'
import VPSDashboardPage from '@renderer/features/ssh/VPSDashboardPage'
import DocsPage from '@renderer/features/docs/DocsPage'
import ToolboxPage from '@renderer/features/tools/ToolboxPage'
import ApiTesterPage from '@renderer/features/tools/ApiTesterPage'
import SnippetsPage from '@renderer/features/tools/SnippetsPage'
import DiffPage from '@renderer/features/tools/DiffPage'
import GeneratorPage from '@renderer/features/tools/GeneratorPage'

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
