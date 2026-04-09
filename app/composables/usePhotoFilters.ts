interface FilterOptions {
  tags: string[]
  cameras: string[]
  lenses: string[]
  cities: string[]
  ratings: number // 改为单个数字，表示最低评分
  search: string // 搜索关键词
  searchField: string // 搜索字段
}

interface FilterStats {
  tags: Map<string, number>
  cameras: Map<string, number>
  lenses: Map<string, number>
  cities: Map<string, number>
  ratings: Map<number, number>
}

// 全局筛选状态管理
const globalFilters = ref<FilterOptions>({
  tags: [],
  cameras: [],
  lenses: [],
  cities: [],
  ratings: 0,
  search: '',
  searchField: 'all', // 默认搜索所有字段
})

export function usePhotoFilters() {
  const { photos } = usePhotos()
  const { sortedPhotos } = usePhotoSort()
  
  // 使用全局筛选状态
  const activeFilters = globalFilters

  // 使用 useFetch 从后端安全异步获取完整的聚合数据（解除分页显示断层问题）
  const { data: globalStats } = useFetch('/api/photos/aggregations', {
    lazy: true,
    server: false,
    default: () => ({
      tags: [],
      cameras: [],
      lenses: [],
      cities: [],
      ratings: []
    })
  })

  // 获取排序后的筛选选项
  const availableFilters = computed(() => globalStats.value)

  // 计算已选择的筛选项数量
  const selectedCounts = computed(() => {
    return {
      tags: activeFilters.value.tags.length,
      cameras: activeFilters.value.cameras.length,
      lenses: activeFilters.value.lenses.length,
      cities: activeFilters.value.cities.length,
      ratings: activeFilters.value.ratings > 0 ? 1 : 0,
      search: activeFilters.value.search.length > 0 ? 1 : 0
    }
  })

  // 筛选后的照片（应用排序）
  const filteredPhotos = computed(() => {
    // 先获取排序后的照片，再应用筛选
    return sortedPhotos.value.filter(photo => {
      // 搜索筛选
      if (activeFilters.value.search) {
        const searchTerm = activeFilters.value.search.toLowerCase()
        const field = activeFilters.value.searchField
        
        // 构建搜索字段内容
        let searchableText = ''
        
        switch (field) {
          case 'id':
            searchableText = photo.id || ''
            break
          case 'title':
            searchableText = photo.title || ''
            break
          case 'tags':
            searchableText = photo.tags?.join(' ') || ''
            break
          case 'location':
             searchableText = [
              photo.city || '',
              photo.country || '',
              photo.locationName || ''
            ].join(' ')
            break
          case 'dateTaken':
             searchableText = photo.dateTaken || ''
            break
          case 'all':
          default:
            searchableText = [
              photo.tags?.join(' ') || '',
              photo.exif?.Make || '',
              photo.exif?.Model || '',
              photo.exif?.LensMake || '',
              photo.exif?.LensModel || '',
              photo.city || '',
              photo.country || '',
              photo.title || '',
              photo.description || '',
              photo.storageKey || '',
              photo.locationName || '',
              photo.id || '', // Include ID in global search as well
              photo.dateTaken || ''
            ].join(' ')
            break
        }

        if (!searchableText.toLowerCase().includes(searchTerm)) {
          return false
        }
      }

      // 标签筛选
      if (activeFilters.value.tags.length > 0) {
        const photoTags = photo.tags || []
        const hasMatchingTag = activeFilters.value.tags.some(tag => 
          photoTags.includes(tag)
        )
        if (!hasMatchingTag) return false
      }

      // 相机筛选
      if (activeFilters.value.cameras.length > 0) {
        const photoCamera = photo.exif?.Make && photo.exif?.Model 
          ? `${photo.exif.Make} ${photo.exif.Model}`
          : null
        if (!photoCamera || !activeFilters.value.cameras.includes(photoCamera)) {
          return false
        }
      }

      // 镜头筛选
      if (activeFilters.value.lenses.length > 0) {
        const photoLens = photo.exif?.LensMake && photo.exif?.LensModel
          ? `${photo.exif.LensMake} ${photo.exif.LensModel}`
          : photo.exif?.LensModel || null
        if (!photoLens || !activeFilters.value.lenses.includes(photoLens)) {
          return false
        }
      }

      // 城市筛选
      if (activeFilters.value.cities.length > 0) {
        if (!photo.city || !activeFilters.value.cities.includes(photo.city)) {
          return false
        }
      }

      // 评分筛选
      if (activeFilters.value.ratings > 0) {
        const photoRating = photo.exif?.Rating || 0
        if (photoRating < activeFilters.value.ratings) {
          return false
        }
      }

      return true
    })
  })

  // 切换筛选项
  const toggleFilter = (type: keyof FilterOptions, value: string | number) => {
    const filters = activeFilters.value[type] as any[]
    const index = filters.indexOf(value)
    
    if (index === -1) {
      filters.push(value)
    } else {
      filters.splice(index, 1)
    }
  }

  // 清除所有筛选
  const clearAllFilters = () => {
    activeFilters.value = {
      tags: [],
      cameras: [],
      lenses: [],
      cities: [],
      ratings: 0,
      search: '',
      searchField: 'all'
    }
  }

  // 清除指定类型的筛选
  const clearFilterType = (type: keyof FilterOptions) => {
    if (type === 'ratings' || type === 'search') {
      (activeFilters.value as any)[type] = type === 'ratings' ? 0 : ''
    } else {
      (activeFilters.value as any)[type] = []
    }
  }

  // 检查筛选项是否被选中
  const isFilterSelected = (type: keyof FilterOptions, value: string | number) => {
    return (activeFilters.value[type] as any[]).includes(value)
  }

  // 检查是否有任何筛选项被激活
  const hasActiveFilters = computed(() => {
    return activeFilters.value.tags.length > 0 ||
           activeFilters.value.cameras.length > 0 ||
           activeFilters.value.lenses.length > 0 ||
           activeFilters.value.cities.length > 0 ||
           activeFilters.value.ratings > 0 ||
           activeFilters.value.search.length > 0
  })

  return {
    activeFilters: activeFilters,
    availableFilters,
    selectedCounts,
    filteredPhotos,
    hasActiveFilters,
    toggleFilter,
    clearAllFilters,
    clearFilterType,
    isFilterSelected
  }
}
