import { useEffect, useState } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import { ConnectionHeader } from './components/ConnectionHeader'
import { ClientView } from './components/ClientView'
import { MessageLog } from './components/MessageLog'
import { ProtocolControls } from './components/ProtocolControls'
import { DeviceSettingsPanel } from './components/DeviceSettingsPanel'
import { HttpPanel } from './components/HttpPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { STORAGE_KEYS, getStorageJSON, setStorageJSON } from './lib/persistence'
import { applyBrightness, applyTheme } from './features/device/deviceSetters'
import { useStore } from './store'

export default function App() {
  const [savedLayout] = useState(
    () => getStorageJSON<Record<string, number>>(STORAGE_KEYS.PANEL_LAYOUT) ?? undefined
  )

  useEffect(() => {
    const { brightness, theme } = useStore.getState()
    applyBrightness(brightness)
    applyTheme(theme)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <ConnectionHeader />
      <Group
        orientation="horizontal"
        className="flex-1 overflow-hidden"
        defaultLayout={savedLayout}
        onLayoutChanged={(layout) => setStorageJSON(STORAGE_KEYS.PANEL_LAYOUT, layout)}
      >
        {/* 左栏：客户端模拟 */}
        <Panel id="left" defaultSize="42%" minSize="20%" maxSize="70%" className="flex flex-col overflow-hidden">
          <ClientView />
        </Panel>

        <Separator className="w-1.5 bg-border hover:bg-primary/60 transition-colors cursor-col-resize" />

        {/* 右栏：调试面板 */}
        <Panel id="right" minSize="30%" className="flex flex-col overflow-hidden">
          <Tabs defaultValue="log" className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 pt-2 border-b shrink-0">
              <TabsList className="h-8">
                <TabsTrigger value="log" className="text-xs h-7">协议日志</TabsTrigger>
                <TabsTrigger value="iot" className="text-xs h-7">设备</TabsTrigger>
                <TabsTrigger value="http" className="text-xs h-7">HTTP</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs h-7">设置</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="log" className="flex-1 flex flex-col overflow-hidden mt-0 border-0">
              <MessageLog />
              <ProtocolControls />
            </TabsContent>
            <TabsContent value="iot" className="flex-1 overflow-auto mt-0 border-0">
              <DeviceSettingsPanel />
            </TabsContent>
            <TabsContent value="http" className="flex-1 overflow-auto mt-0 border-0">
              <HttpPanel />
            </TabsContent>
            <TabsContent value="settings" className="flex-1 overflow-auto mt-0 border-0">
              <SettingsPanel />
            </TabsContent>
          </Tabs>
        </Panel>
      </Group>
    </div>
  )
}
