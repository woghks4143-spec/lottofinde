import { Tabs } from 'expo-router';
import { SimpleTabBar, SIMPLE_TABS } from '@/src/components/TabBar';

export default function SimpleLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <SimpleTabBar {...props} />}>
      {SIMPLE_TABS.map((spec) => (
        <Tabs.Screen key={spec.key} name={spec.key} options={{ title: spec.label }} />
      ))}
    </Tabs>
  );
}
