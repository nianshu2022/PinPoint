<script setup lang="ts">
import { useWizardStore } from '~/stores/wizard'

definePageMeta({
  layout: 'onboarding',
})

const loading = ref(false)
const store = useWizardStore()
const toast = useToast()
const { fetch: fetchUserSession } = useUserSession()

async function onComplete() {
  loading.value = true
  
  // Prepare data outside try block so it's accessible in catch
  let adminData: any
  let siteData: any
  let storageData: any
  let mapData: any
  
  try {
    // 1. Prepare Admin Data
    adminData = store.admin
    if (!adminData.email || adminData.email.trim() === '') {
      throw new Error('管理员邮箱是必需的，请返回管理员配置页面填写')
    }
    if (!adminData.password || adminData.password.length < 6) {
      throw new Error('管理员密码至少需要 6 个字符，请返回管理员配置页面填写')
    }
    if (!adminData.username || adminData.username.trim() === '') {
      adminData.username = 'admin' // Use default
    }

    // 2. Prepare Site Data
    siteData = store.site
    if (!siteData.title || siteData.title.trim() === '') {
      throw new Error('站点标题是必需的，请返回站点配置页面填写')
    }

    // 3. Prepare Storage Data
    const storageState = store.storage
    const storageProvider = storageState.provider
    const storageConfig: Record<string, any> = { provider: storageProvider }

    // Extract provider specific keys
    Object.keys(storageState).forEach((key) => {
      if (key.startsWith(storageProvider + '.')) {
        const configKey = key.split('.')[1]!
        let value = storageState[key]
        
        // Handle type conversions
        if (configKey === 'forcePathStyle') {
          // Convert to boolean
          value = value === true || value === 'true' || value === '1'
        } else if (configKey === 'maxKeys') {
          // Convert to number
          const numValue = Number(value)
          value = isNaN(numValue) ? undefined : numValue
        }
        
        // Only skip empty values for optional fields
        // Required fields (endpoint, bucket, accessKeyId, secretAccessKey) should be kept
        // so validation errors can be shown properly
        const optionalFields = ['prefix', 'cdnUrl', 'forcePathStyle', 'maxKeys', 'baseUrl', 'style']
        if (optionalFields.includes(configKey) && (value === '' || value === null || value === undefined)) {
          return
        }
        
        storageConfig[configKey] = value
      }
    })

    // Validate required S3 fields
    if (storageProvider === 's3') {
      const requiredFields = ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey']
      const missingFields = requiredFields.filter(field => !storageConfig[field] || storageConfig[field].trim() === '')
      if (missingFields.length > 0) {
        throw new Error(`存储配置缺少必需字段：${missingFields.join(', ')}。请返回存储配置页面填写完整信息。`)
      }
    }

    storageData = {
      name: storageState.name || 'Default Storage',
      config: storageConfig,
    }

    // 4. Prepare Map Data
    const mapState = store.map
    const mapProvider = mapState.provider
    const mapTokenKey = `${mapProvider}.token`
    const mapStyleKey = `${mapProvider}.style`

    // Ensure token is provided
    const mapToken = mapState[mapTokenKey]
    if (!mapToken || mapToken.trim() === '') {
      throw new Error(`地图 ${mapProvider} 的 Token 是必需的，请返回地图配置页面填写`)
    }

    mapData = {
      provider: mapProvider,
      token: mapToken,
      style: mapState[mapStyleKey] || undefined,
    }

    // 5. Submit All
    await $fetch('/api/wizard/submit', {
      method: 'POST',
      body: {
        admin: adminData,
        site: siteData,
        storage: storageData,
        map: mapData,
      },
    })

    // 6. Auto login with the admin credentials
    try {
      await $fetch('/api/login', {
        method: 'POST',
        body: {
          email: adminData.email,
          password: adminData.password,
        },
      })
      
      // Refresh user session
      await fetchUserSession()
    } catch (loginError) {
      console.warn('Auto login failed, user will need to login manually:', loginError)
      // Continue anyway, user can login manually
    }

    // Clear store
    store.clear()

    // Force reload to apply settings
    window.location.href = '/dashboard'
  } catch (error: any) {
    console.error('Setup error:', error)
    console.error('Error data:', error.data)
    console.error('Request body:', {
      admin: adminData,
      site: siteData,
      storage: storageData,
      map: mapData,
    })
    
    // Extract validation error details
    let errorMessage = 'Failed to complete setup'
    
    // Parse Zod validation errors from message
    if (error.data?.message) {
      try {
        const issues = JSON.parse(error.data.message)
        if (Array.isArray(issues)) {
          const errorDetails = issues.map((issue: any) => {
            const path = issue.path?.join('.') || 'unknown'
            return `${path}: ${issue.message || issue.code || 'validation error'}`
          }).join('\n')
          errorMessage = `验证错误：\n${errorDetails}`
        } else {
          errorMessage = error.data.message
        }
      } catch {
        errorMessage = error.data.message
      }
    } else if (error.data?.issues) {
      // Zod validation errors (alternative format)
      const issues = error.data.issues.map((issue: any) => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join('\n')
      errorMessage = `验证错误：\n${issues}`
    } else if (error.message) {
      errorMessage = error.message
    }
    
    toast.add({
      title: '设置失败',
      description: errorMessage,
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <WizardStep
    title="即将完成！"
    description="您的 ChronoFrame 画廊已准备好使用。"
  >
    <div
      class="flex flex-col items-center justify-center py-12 space-y-8 text-center"
    >
      <div class="relative">
        <div
          class="absolute inset-0 bg-green-500/20 blur-3xl rounded-full"
        ></div>
        <div
          class="relative size-28 bg-linear-to-br from-green-400/20 to-green-600/20 rounded-full flex items-center justify-center border border-green-500/30 shadow-2xl shadow-green-500/20"
        >
          <UIcon
            name="tabler:check"
            class="size-18 text-green-400"
          />
        </div>
      </div>

      <div class="max-w-md text-neutral-300 text-lg">
        <p>
          您已完成了所有基本配置。现在可以使用管理员账户登录并开始上传照片。
        </p>
      </div>

      <WizardButton
        size="xl"
        color="primary"
        :loading="loading"
        class="px-6 py-3 text-base font-bold shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 transition-all duration-300"
        @click="onComplete"
      >
        前往仪表盘
      </WizardButton>
    </div>
  </WizardStep>
</template>
