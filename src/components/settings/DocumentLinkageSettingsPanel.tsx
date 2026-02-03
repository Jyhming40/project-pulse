import { Link2, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentLinkagePanel } from './DocumentLinkagePanel';
import { DocumentExpiryRulesPanel } from './DocumentExpiryRulesPanel';

export function DocumentLinkageSettingsPanel() {
  return (
    <Tabs defaultValue="linkage" className="space-y-4">
      <TabsList>
        <TabsTrigger value="linkage" className="flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          連動規則
        </TabsTrigger>
        <TabsTrigger value="expiry" className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          效期規則
        </TabsTrigger>
      </TabsList>

      <TabsContent value="linkage">
        <DocumentLinkagePanel />
      </TabsContent>

      <TabsContent value="expiry">
        <DocumentExpiryRulesPanel />
      </TabsContent>
    </Tabs>
  );
}
