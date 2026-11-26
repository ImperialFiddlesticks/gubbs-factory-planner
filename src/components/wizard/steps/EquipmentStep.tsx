import { Cog, Hammer, Package, Truck, Wrench, type LucideIcon } from 'lucide-react'
import { ChoiceCard } from '@/components/wizard/ChoiceCard'
import { CATALOG } from '@/data/catalog'
import { EQUIPMENT_CATEGORIES, type EquipmentCategoryId } from '@/data/categories'
import { usePlanner } from '@/store'

const CATEGORY_ICONS: Record<EquipmentCategoryId, LucideIcon> = {
  machining: Cog,
  forming: Hammer,
  'material-handling': Truck,
  'assembly-packing': Package,
  support: Wrench,
}

export function EquipmentStep() {
  const selected = usePlanner((s) => s.wizard.categories)
  const updateSetup = usePlanner((s) => s.updateSetup)

  function toggle(id: EquipmentCategoryId) {
    updateSetup({
      categories: selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id],
    })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {EQUIPMENT_CATEGORIES.map((category) => {
        const count = CATALOG.filter((m) => m.category === category.id).length
        return (
          <ChoiceCard
            key={category.id}
            icon={CATEGORY_ICONS[category.id]}
            title={category.name}
            description={`${category.description} ${count} ${count === 1 ? 'machine' : 'machines'} in the catalog.`}
            selected={selected.includes(category.id)}
            onSelect={() => toggle(category.id)}
          />
        )
      })}
    </div>
  )
}
