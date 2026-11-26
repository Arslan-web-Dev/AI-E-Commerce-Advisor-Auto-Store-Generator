import ThemeConfigurator from '@/components/theme-configurator/ThemeConfigurator';

export default async function StorefrontWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="min-h-screen p-5 md:p-10" style={{ background: 'var(--surface)' }}>
      <div className="mx-auto max-w-7xl">
        <ThemeConfigurator projectId={id} />
      </div>
    </main>
  );
}
