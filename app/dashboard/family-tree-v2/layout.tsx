export default function FamilyTreeLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      zIndex: 50
    }}>
      {children}
    </div>
  )
}