class LinksManager {
  constructor() {
    this.links = []
    this.reminders = []
    this.settings = {
      theme: "light",
      enableNotifications: true,
      autoFillForms: true,
      showContextMenu: true,
      defaultCategory: "personal",
      enableAnimations: true,
      enableLinkPreview: true,
      aiEnabled: true,
      autoCategorize: true,
      smartTags: true,
    }
    this.stats = {
      totalClicks: 0,
      todayClicks: 0,
      weeklyUsage: Array(7).fill(0),
    }
    this.draggedItem = null
    this.searchTerm = ""
    this.aiCache = new Map() // Cache for AI results

    this.init()
  }

  async init() {
    await this.loadData()
    await this.cleanupPastReminders()
    this.setupEventListeners()
    this.setupDragAndDrop()
    this.renderLinks()
    this.renderReminders()
    this.updateStats()
    this.applyTheme()
    this.checkFirstVisit()
  }

  checkFirstVisit() {
    // Check if this is the first time opening the extension
    if (!this.settings.hasSeenWelcome) {
      this.showWelcomeMessage()
      this.settings.hasSeenWelcome = true
      this.saveData()
    }
  }

  showWelcomeMessage() {
    // Create welcome modal
    const welcomeModal = document.createElement('div')
    welcomeModal.id = 'welcomeModal'
    welcomeModal.className = 'modal welcome-modal'
    welcomeModal.innerHTML = `
      <div class="modal-content welcome-content">
        <div class="welcome-header">
          <div class="welcome-icon">🎉</div>
          <h2>Welcome to Link Manager!</h2>
          <p class="welcome-subtitle">Your smart solution for organizing links</p>
        </div>
        
        <div class="welcome-features">
          <div class="welcome-feature">
            <span class="feature-icon">🔗</span>
            <div>
              <h3>Save & Organize Links</h3>
              <p>Store all your important links in one place with categories</p>
            </div>
          </div>
          
          <div class="welcome-feature">
            <span class="feature-icon">⏰</span>
            <div>
              <h3>Set Reminders</h3>
              <p>Never forget important tasks with smart notifications</p>
            </div>
          </div>
          
          <div class="welcome-feature">
            <span class="feature-icon">🏷️</span>
            <div>
              <h3>Tag & Search</h3>
              <p>Find links quickly with tags and powerful search</p>
            </div>
          </div>
          
          <div class="welcome-feature">
            <span class="feature-icon">🎨</span>
            <div>
              <h3>Drag & Drop</h3>
              <p>Reorder links easily with smooth animations</p>
            </div>
          </div>
          
          <div class="welcome-feature">
            <span class="feature-icon">🩺</span>
            <div>
              <h3>Health Check</h3>
              <p>Monitor if your saved links are still working</p>
            </div>
          </div>
          
          <div class="welcome-feature">
            <span class="feature-icon">📊</span>
            <div>
              <h3>Track Stats</h3>
              <p>See your most used links and categories</p>
            </div>
          </div>
        </div>
        
        <div class="welcome-footer">
          <button class="btn btn-primary welcome-btn" id="welcomeStart">
            Get Started 🚀
          </button>
          <p class="welcome-tip">💡 Tip: Click the ➕ button to add your first link!</p>
        </div>
      </div>
    `
    
    document.body.appendChild(welcomeModal)
    
    // Animate in
    setTimeout(() => {
      welcomeModal.classList.add('show')
    }, 100)
    
    // Add event listener to close button
    document.getElementById('welcomeStart').addEventListener('click', () => {
      welcomeModal.classList.remove('show')
      setTimeout(() => {
        welcomeModal.remove()
      }, 300)
    })
  }

  async cleanupPastReminders() {
    const now = new Date().getTime()
    const initialCount = this.reminders.length
    
    // Remove past reminders that are still marked as incomplete
    this.reminders = this.reminders.filter((reminder) => {
      const reminderTime = new Date(reminder.time).getTime()
      return reminderTime > now || reminder.completed
    })
    
    // Also remove old completed reminders (older than 24 hours)
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    this.reminders = this.reminders.filter((reminder) => {
      if (reminder.completed) {
        const completedTime = new Date(reminder.time).getTime()
        return completedTime > oneDayAgo
      }
      return true
    })
    
    if (this.reminders.length !== initialCount) {
      await this.saveData()
      console.log(`Cleaned up ${initialCount - this.reminders.length} old reminders`)
    }
  }

  async loadData() {
    try {
      const result = await chrome.storage.sync.get(["links", "reminders", "settings", "stats"])
      this.links = result.links || []
      this.reminders = result.reminders || []
      this.settings = { ...this.settings, ...result.settings }
      this.stats = { ...this.stats, ...result.stats }
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  async saveData() {
    try {
      await chrome.storage.sync.set({
        links: this.links,
        reminders: this.reminders,
        settings: this.settings,
        stats: this.stats,
      })
    } catch (error) {
      console.error("Error saving data:", error)
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab)
      })
    })

    // Theme toggle
    const themeToggle = document.getElementById("themeToggle")
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        this.toggleTheme()
      })
    }

    // Settings
    const settingsBtn = document.getElementById("settingsBtn")
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.openSettings()
      })
    }

    const closeSettings = document.getElementById("closeSettings")
    if (closeSettings) {
      closeSettings.addEventListener("click", () => {
        this.closeSettings()
      })
    }

    const saveSettings = document.getElementById("saveSettings")
    if (saveSettings) {
      saveSettings.addEventListener("click", () => {
        this.saveSettings()
      })
    }

    // Test notification
    const testNotification = document.getElementById("testNotification")
    if (testNotification) {
      testNotification.addEventListener("click", async () => {
        try {
          // Test browser notification permission
          if (Notification.permission === "default") {
            const permission = await Notification.requestPermission()
            if (permission !== "granted") {
              this.showToast("Notification permission denied", "error")
              return
            }
          }

          // Send message to background script to create notification
          chrome.runtime.sendMessage({ action: "testNotification" }, (response) => {
            if (response && response.success) {
              this.showToast("Test notification sent!")
            } else {
              this.showToast("Failed to send test notification", "error")
            }
          })
        } catch (error) {
          console.error("Error testing notification:", error)
          this.showToast("Error testing notification", "error")
        }
      })
    }

    // Show welcome message
    const showWelcome = document.getElementById("showWelcome")
    if (showWelcome) {
      showWelcome.addEventListener("click", () => {
        this.showWelcomeMessage()
        this.closeSettings()
      })
    }

    // Add link form
    const toggleAddForm = document.getElementById("toggleAddForm")
    if (toggleAddForm) {
      toggleAddForm.addEventListener("click", () => {
        this.toggleAddForm()
      })
    }

    const addLinkForm = document.getElementById("addLinkForm")
    if (addLinkForm) {
      addLinkForm.addEventListener("submit", (e) => {
        e.preventDefault()
        this.addLink()
      })
    }

    const cancelAdd = document.getElementById("cancelAdd")
    if (cancelAdd) {
      cancelAdd.addEventListener("click", () => {
        this.toggleAddForm()
      })
    }

    // Add reminder form
    const toggleReminderForm = document.getElementById("toggleReminderForm")
    if (toggleReminderForm) {
      toggleReminderForm.addEventListener("click", () => {
        this.toggleReminderForm()
      })
    }

    const addReminderForm = document.getElementById("addReminderForm")
    if (addReminderForm) {
      addReminderForm.addEventListener("submit", (e) => {
        e.preventDefault()
        this.addReminder()
      })
    }

    const cancelReminder = document.getElementById("cancelReminder")
    if (cancelReminder) {
      cancelReminder.addEventListener("click", () => {
        this.toggleReminderForm()
      })
    }

    // Search and filter
    const searchInput = document.getElementById("searchInput")
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        this.filterLinks()
      })
    }

    const categoryFilter = document.getElementById("categoryFilter")
    if (categoryFilter) {
      categoryFilter.addEventListener("change", () => {
        this.filterLinks()
      })
    }

    // Import/Export
    const exportLinks = document.getElementById("exportLinks")
    if (exportLinks) {
      exportLinks.addEventListener("click", () => {
        this.exportData()
      })
    }

    const importLinks = document.getElementById("importLinks")
    if (importLinks) {
      importLinks.addEventListener("click", () => {
        const importFile = document.getElementById("importFile")
        if (importFile) importFile.click()
      })
    }

    const importFile = document.getElementById("importFile")
    if (importFile) {
      importFile.addEventListener("change", (e) => {
        this.importData(e.target.files[0])
      })
    }

    // Event delegation for link actions
    const linksList = document.getElementById("linksList")
    if (linksList) {
      linksList.addEventListener("click", (e) => {
        if (e.target.matches("[data-action]")) {
          const action = e.target.dataset.action
          const id = e.target.dataset.id

          switch (action) {
            case "copy":
              this.copyLink(id)
              break
            case "open":
              this.openLink(id)
              break
            case "health":
              this.checkLinkHealth(id)
              break
            case "edit":
              this.editLink(id)
              break
            case "delete":
              this.deleteLink(id)
              break
          }
        }
      })
    }

    // Event delegation for reminder actions
    document.getElementById("remindersList").addEventListener("click", (e) => {
      if (e.target.matches("[data-action]")) {
        const action = e.target.dataset.action
        const id = e.target.dataset.id

        switch (action) {
          case "complete":
            this.completeReminder(id)
            break
          case "delete-reminder":
            this.deleteReminder(id)
            break
        }
      }
    })
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`)
    if (tabButton) {
      tabButton.classList.add("active")
    }

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active")
    })
    
    const tabContent = document.getElementById(`${tabName}Tab`)
    if (tabContent) {
      tabContent.classList.add("active")
    }

    // Update stats when switching to stats tab
    if (tabName === "stats") {
      this.updateStats()
    }
  }

  toggleTheme() {
    this.settings.theme = this.settings.theme === "light" ? "dark" : "light"
    this.applyTheme()
    this.saveData()
  }

  applyTheme() {
    document.body.setAttribute("data-theme", this.settings.theme)
    const themeIcon = document.querySelector(".theme-icon")
    themeIcon.textContent = this.settings.theme === "light" ? "🌙" : "☀️"
  }

  openSettings() {
    document.getElementById("settingsModal").classList.remove("hidden")
    this.loadSettingsForm()
  }

  closeSettings() {
    document.getElementById("settingsModal").classList.add("hidden")
  }

  loadSettingsForm() {
    document.getElementById("enableNotifications").checked = this.settings.enableNotifications
    document.getElementById("autoFillForms").checked = this.settings.autoFillForms
    document.getElementById("showContextMenu").checked = this.settings.showContextMenu
    document.getElementById("defaultCategory").value = this.settings.defaultCategory
    
    // AI settings
    const aiEnabledCheckbox = document.getElementById("aiEnabled")
    if (aiEnabledCheckbox) {
      aiEnabledCheckbox.checked = this.settings.aiEnabled
    }
    const autoCategorizeCheckbox = document.getElementById("autoCategorize")
    if (autoCategorizeCheckbox) {
      autoCategorizeCheckbox.checked = this.settings.autoCategorize
    }
    const smartTagsCheckbox = document.getElementById("smartTags")
    if (smartTagsCheckbox) {
      smartTagsCheckbox.checked = this.settings.smartTags
    }
  }

  saveSettings() {
    this.settings.enableNotifications = document.getElementById("enableNotifications").checked
    this.settings.autoFillForms = document.getElementById("autoFillForms").checked
    this.settings.showContextMenu = document.getElementById("showContextMenu").checked
    this.settings.defaultCategory = document.getElementById("defaultCategory").value

    // AI settings
    const aiEnabledCheckbox = document.getElementById("aiEnabled")
    if (aiEnabledCheckbox) {
      this.settings.aiEnabled = aiEnabledCheckbox.checked
    }
    const autoCategorizeCheckbox = document.getElementById("autoCategorize")
    if (autoCategorizeCheckbox) {
      this.settings.autoCategorize = autoCategorizeCheckbox.checked
    }
    const smartTagsCheckbox = document.getElementById("smartTags")
    if (smartTagsCheckbox) {
      this.settings.smartTags = smartTagsCheckbox.checked
    }

    this.saveData()
    this.closeSettings()
    this.showToast("Settings saved successfully!")
  }

  toggleAddForm() {
    const form = document.getElementById("addLinkForm")
    form.classList.toggle("hidden")
    
    if (!form.classList.contains("hidden")) {
      document.getElementById("linkTitle").focus()
    } else {
      this.clearAddForm()
      
      // Reset edit mode
      delete form.dataset.editingId
      const formContainer = form.parentElement
      const formTitle = formContainer.querySelector("h3")
      if (formTitle) {
        formTitle.textContent = "Add New Link"
      }
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) {
        submitBtn.textContent = "Add Link"
      }
    }
  }

  toggleReminderForm() {
    const form = document.getElementById("addReminderForm")
    form.classList.toggle("hidden")
    if (!form.classList.contains("hidden")) {
      document.getElementById("reminderTitle").focus()
    } else {
      this.clearReminderForm()
    }
  }

  async addLink() {
    const title = document.getElementById("linkTitle").value.trim()
    const url = document.getElementById("linkUrl").value.trim()
    const category = document.getElementById("linkCategory").value
    const description = document.getElementById("linkDescription").value.trim()
    const form = document.getElementById("addLinkForm")
    const editingId = form.dataset.editingId

    if (!title || !url || !category) {
      this.showToast("Please fill in all required fields", "error")
      return
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      this.showToast("Please enter a valid URL", "error")
      return
    }

    if (editingId) {
      // Update existing link
      const link = this.links.find((l) => l.id === editingId)
      if (link) {
        link.title = title
        link.url = url
        link.category = category
        link.description = description
        link.updatedAt = new Date().toISOString()
        
        await this.saveData()
        this.renderLinks()
        this.toggleAddForm()
        this.showToast("Link updated successfully!")
        
        // Reset form
        delete form.dataset.editingId
        const formContainer = form.parentElement
        const formTitle = formContainer.querySelector("h3")
        if (formTitle) {
          formTitle.textContent = "Add New Link"
        }
        const submitBtn = form.querySelector('button[type="submit"]')
        if (submitBtn) {
          submitBtn.textContent = "Add Link"
        }
      }
    } else {
      // Add new link with AI enhancement
      try {
        let linkData = {
          id: Date.now().toString(),
          title,
          url,
          category,
          description,
          createdAt: new Date().toISOString(),
          clickCount: 0,
        }

        // Apply AI enhancements
        if (this.settings.aiEnabled) {
          linkData = await this.enhanceLinkWithAI(linkData)
        }

        this.links.unshift(linkData)
        await this.saveData()
        this.renderLinks()
        this.toggleAddForm()
        this.showToast("✨ Link added successfully!")
      } catch (error) {
        if (error.message === 'Duplicate link cancelled') {
          this.showToast("Link not added", "warning")
        } else {
          console.error('Error adding link:', error)
          this.showToast("Error adding link", "error")
        }
      }
    }
  }

  async addReminder() {
    const title = document.getElementById("reminderTitle").value.trim()
    const description = document.getElementById("reminderDescription").value.trim()
    const time = document.getElementById("reminderTime").value
    const priority = document.getElementById("reminderPriority").value

    if (!title || !time) {
      this.showToast("Please fill in all required fields", "error")
      return
    }

    const reminderTime = new Date(time)
    if (reminderTime <= new Date()) {
      this.showToast("Please select a future date and time", "error")
      return
    }

    const reminder = {
      id: Date.now().toString(),
      title,
      description,
      time: reminderTime.toISOString(),
      priority,
      createdAt: new Date().toISOString(),
      completed: false,
    }

    this.reminders.unshift(reminder)
    await this.saveData()
    this.renderReminders()
    this.toggleReminderForm()

    // Set the reminder alarm
    await this.setReminder(reminder)
  }

  async setReminder(reminder) {
    try {
      const reminderTime = new Date(reminder.time).getTime()
      const now = Date.now()

      if (reminderTime <= now) {
        this.showToast("Reminder time must be in the future", "error")
        return
      }

      // Send message to background script to create the alarm
      // This ensures the alarm persists even after popup closes
      chrome.runtime.sendMessage({
        action: "createAlarm",
        reminder: reminder
      }, (response) => {
        if (response && response.success) {
          console.log(`Reminder set for ${new Date(reminderTime).toLocaleString()}`)
          this.showToast(`Reminder set for ${new Date(reminderTime).toLocaleString()}`)
        } else {
          console.error("Failed to create alarm")
          this.showToast("Failed to set reminder", "error")
        }
      })
    } catch (error) {
      console.error("Error setting reminder:", error)
      this.showToast("Failed to set reminder", "error")
    }
  }

  renderLinks() {
    const container = document.getElementById("linksList")
    if (!container) return
    
    const searchTerm = document.getElementById("searchInput")?.value.toLowerCase() || ""
    const categoryFilter = document.getElementById("categoryFilter")?.value || ""

    let filteredLinks = this.links

    if (searchTerm) {
      filteredLinks = filteredLinks.filter(
        (link) =>
          link.title.toLowerCase().includes(searchTerm) ||
          link.url.toLowerCase().includes(searchTerm) ||
          (link.description && link.description.toLowerCase().includes(searchTerm)) ||
          (link.tags && link.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      )
    }

    if (categoryFilter) {
      filteredLinks = filteredLinks.filter((link) => link.category === categoryFilter)
    }

    if (filteredLinks.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔗</div>
                    <div class="empty-state-text">
                        ${this.links.length === 0 ? "No links added yet" : "No links match your search"}
                    </div>
                </div>
            `
      return
    }

    container.innerHTML = filteredLinks
      .map(
        (link) => `
            <div class="link-item" data-id="${link.id}" draggable="true">
                <div class="link-info">
                    <div class="link-title">
                        ${this.getCategoryIcon(link.category)} ${this.highlightSearchTerm(link.title, searchTerm)}
                        ${link.healthStatus ? `
                            <span class="link-health ${link.healthStatus}">
                                ${link.healthStatus === 'healthy' ? '✓' : link.healthStatus === 'checking' ? '⟳' : '✗'}
                            </span>
                        ` : ''}
                    </div>
                    <div class="link-url">${this.highlightSearchTerm(link.url, searchTerm)}</div>
                    ${link.description ? `<div class="link-description">${this.highlightSearchTerm(link.description, searchTerm)}</div>` : ""}
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                        <span class="link-category">${link.category}</span>
                        ${link.tags && link.tags.length > 0 ? `
                            <div class="link-tags">
                                ${link.tags.map(tag => `
                                    <span class="tag">
                                        ${tag}
                                        <span class="tag-remove" onclick="linksManager.removeTagFromLink('${link.id}', '${tag}')">×</span>
                                    </span>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${link.clickCount ? `<span class="link-stats-badge">👆 ${link.clickCount} clicks</span>` : ''}
                    </div>
                </div>
                <div class="link-actions">
                    <button class="action-btn copy-btn" data-action="copy" data-id="${link.id}" title="Copy URL">
                        📋
                    </button>
                    <button class="action-btn" data-action="open" data-id="${link.id}" title="Open Link">
                        🔗
                    </button>
                    <button class="action-btn" data-action="health" data-id="${link.id}" title="Check Link Health">
                        🩺
                    </button>
                    <button class="action-btn edit-btn" data-action="edit" data-id="${link.id}" title="Edit">
                        ✏️
                    </button>
                    <button class="action-btn delete-btn" data-action="delete" data-id="${link.id}" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `,
      )
      .join("")
  }

  renderReminders() {
    const container = document.getElementById("remindersList")
    const activeReminders = this.reminders.filter((r) => !r.completed)

    if (activeReminders.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⏰</div>
                    <div class="empty-state-text">No active reminders</div>
                </div>
            `
      return
    }

    container.innerHTML = activeReminders
      .map(
        (reminder) => `
            <div class="reminder-item ${reminder.priority}-priority" data-id="${reminder.id}">
                <div class="reminder-title">${reminder.title}</div>
                <div class="reminder-time">
                    ${new Date(reminder.time).toLocaleString()}
                </div>
                ${reminder.description ? `<div class="reminder-description">${reminder.description}</div>` : ""}
                <div class="link-actions" style="margin-top: 0.5rem;">
                    <button class="action-btn" data-action="complete" data-id="${reminder.id}">
                        ✅ Complete
                    </button>
                    <button class="action-btn delete-btn" data-action="delete-reminder" data-id="${reminder.id}">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `,
      )
      .join("")
  }

  updateStats() {
    document.getElementById("totalLinks").textContent = this.links.length
    document.getElementById("activeReminders").textContent = this.reminders.filter((r) => !r.completed).length
    document.getElementById("todayClicks").textContent = this.stats.todayClicks || 0

    // Calculate most used category
    const categoryCount = {}
    this.links.forEach((link) => {
      categoryCount[link.category] = (categoryCount[link.category] || 0) + link.clickCount
    })

    const topCategory = Object.keys(categoryCount).reduce(
      (a, b) => (categoryCount[a] > categoryCount[b] ? a : b),
      "None",
    )

    document.getElementById("topCategory").textContent =
      topCategory === "None" ? "None" : topCategory.charAt(0).toUpperCase() + topCategory.slice(1)
  }

  getCategoryIcon(category) {
    const icons = {
      social: "📱",
      work: "💼",
      personal: "🏠",
      tools: "🔧",
      other: "📎",
    }
    return icons[category] || "📎"
  }

  async copyLink(id) {
    const link = this.links.find((l) => l.id === id)
    if (link) {
      try {
        // Try using the Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(link.url)
          this.showToast("Link copied to clipboard!")
          this.incrementClickCount(id)
        } else {
          // Fallback method for older browsers or when clipboard API fails
          const textArea = document.createElement("textarea")
          textArea.value = link.url
          textArea.style.position = "fixed"
          textArea.style.left = "-999999px"
          textArea.style.top = "-999999px"
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()

          try {
            const successful = document.execCommand("copy")
            if (successful) {
              this.showToast("Link copied to clipboard!")
              this.incrementClickCount(id)
            } else {
              throw new Error("Copy command failed")
            }
          } catch (error) {
            // If all else fails, show the URL in a prompt for manual copying
            prompt("Copy this link:", link.url)
            this.incrementClickCount(id)
          } finally {
            document.body.removeChild(textArea)
          }
        }
      } catch (error) {
        console.error("Error copying link:", error)
        // Fallback: show URL in prompt for manual copying
        prompt("Copy this link:", link.url)
        this.incrementClickCount(id)
      }
    }
  }

  async openLink(id) {
    const link = this.links.find((l) => l.id === id)
    if (link) {
      try {
        await chrome.tabs.create({ url: link.url })
        this.incrementClickCount(id)
      } catch (error) {
        console.error("Error opening link:", error)
      }
    }
  }

  async incrementClickCount(id) {
    const link = this.links.find((l) => l.id === id)
    if (link) {
      link.clickCount = (link.clickCount || 0) + 1
      this.stats.todayClicks = (this.stats.todayClicks || 0) + 1
      await this.saveData()
    }
  }

  async deleteLink(id) {
    if (confirm("Are you sure you want to delete this link?")) {
      this.links = this.links.filter((l) => l.id !== id)
      await this.saveData()
      this.renderLinks()
      this.showToast("Link deleted successfully!")
    }
  }

  editLink(id) {
    const link = this.links.find((l) => l.id === id)
    if (!link) return

    // Show the form
    const form = document.getElementById("addLinkForm")
    form.classList.remove("hidden")

    // Populate form with link data
    document.getElementById("linkTitle").value = link.title
    document.getElementById("linkUrl").value = link.url
    document.getElementById("linkCategory").value = link.category
    document.getElementById("linkDescription").value = link.description || ""

    // Change form title
    const formContainer = form.parentElement
    const formTitle = formContainer.querySelector("h3")
    if (formTitle) {
      formTitle.textContent = "Edit Link"
    }

    // Change submit button text
    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.textContent = "Update Link"
    }

    // Store the ID being edited
    form.dataset.editingId = id

    // Focus on title
    document.getElementById("linkTitle").focus()
  }

  async completeReminder(id) {
    const reminder = this.reminders.find((r) => r.id === id)
    if (reminder) {
      reminder.completed = true
      await this.saveData()
      this.renderReminders()
      this.showToast("Reminder completed!")
    }
  }

  async deleteReminder(id) {
    if (confirm("Are you sure you want to delete this reminder?")) {
      this.reminders = this.reminders.filter((r) => r.id !== id)
      await this.saveData()
      this.renderReminders()
      this.updateStats()
      this.showToast("Reminder deleted successfully!")

      // Cancel alarm via background script
      chrome.runtime.sendMessage({
        action: "clearAlarm",
        alarmId: id
      })
    }
  }

  filterLinks() {
    this.renderLinks()
  }

  clearAddForm() {
    document.getElementById("addLinkForm").reset()
  }

  clearReminderForm() {
    document.getElementById("addReminderForm").reset()
  }

  exportData() {
    const data = {
      links: this.links,
      reminders: this.reminders,
      settings: this.settings,
      exportDate: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `links-plus-backup-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    this.showToast("Data exported successfully!")
  }

  async importData(file) {
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (data.links && Array.isArray(data.links)) {
        this.links = [...this.links, ...data.links]
      }

      if (data.reminders && Array.isArray(data.reminders)) {
        this.reminders = [...this.reminders, ...data.reminders]
      }

      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings }
      }

      await this.saveData()
      this.renderLinks()
      this.renderReminders()
      this.applyTheme()
      this.showToast("Data imported successfully!")
    } catch (error) {
      console.error("Error importing data:", error)
      this.showToast("Failed to import data", "error")
    }
  }

  showToast(message, type = "success") {
    const toast = document.getElementById("toast")
    if (!toast) return
    
    toast.textContent = message
    toast.className = `toast ${type}`
    toast.classList.remove("hidden")
    toast.style.animation = "slideIn 0.3s ease"

    setTimeout(() => {
      toast.style.animation = "fadeOut 0.3s ease"
      setTimeout(() => {
        toast.classList.add("hidden")
      }, 300)
    }, 3000)
  }

  // NEW ADVANCED FEATURES

  setupDragAndDrop() {
    const linksList = document.getElementById("linksList")
    if (!linksList) return

    linksList.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("link-item")) {
        this.draggedItem = e.target
        e.target.classList.add("dragging")
        e.dataTransfer.effectAllowed = "move"
      }
    })

    linksList.addEventListener("dragend", (e) => {
      if (e.target.classList.contains("link-item")) {
        e.target.classList.remove("dragging")
      }
    })

    linksList.addEventListener("dragover", (e) => {
      e.preventDefault()
      const afterElement = this.getDragAfterElement(linksList, e.clientY)
      const draggable = document.querySelector(".dragging")
      if (afterElement == null) {
        linksList.appendChild(draggable)
      } else {
        linksList.insertBefore(draggable, afterElement)
      }
    })

    linksList.addEventListener("drop", (e) => {
      e.preventDefault()
      this.reorderLinks()
    })
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".link-item:not(.dragging)")]

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child }
      } else {
        return closest
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element
  }

  reorderLinks() {
    const linkItems = document.querySelectorAll(".link-item")
    const newOrder = []
    linkItems.forEach(item => {
      const id = item.dataset.id
      const link = this.links.find(l => l.id === id)
      if (link) newOrder.push(link)
    })
    this.links = newOrder
    this.saveData()
    this.showToast("Links reordered!", "success")
  }

  addTagToLink(linkId, tag) {
    const link = this.links.find(l => l.id === linkId)
    if (link && tag.trim()) {
      if (!link.tags) link.tags = []
      if (!link.tags.includes(tag.trim())) {
        link.tags.push(tag.trim())
        this.saveData()
        this.renderLinks()
        this.showToast(`Tag "${tag}" added!`)
      }
    }
  }

  removeTagFromLink(linkId, tag) {
    const link = this.links.find(l => l.id === linkId)
    if (link && link.tags) {
      link.tags = link.tags.filter(t => t !== tag)
      this.saveData()
      this.renderLinks()
      this.showToast(`Tag "${tag}" removed!`)
    }
  }

  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text
    const regex = new RegExp(`(${searchTerm})`, "gi")
    return text.replace(regex, '<span class="highlight">$1</span>')
  }

  async checkLinkHealth(linkId) {
    const link = this.links.find(l => l.id === linkId)
    if (!link) return

    link.healthStatus = "checking"
    this.renderLinks()

    try {
      const response = await fetch(link.url, { method: "HEAD", mode: "no-cors" })
      // In no-cors mode, we can't check status, so we assume it's healthy if no error
      link.healthStatus = "healthy"
      link.lastChecked = new Date().toISOString()
    } catch (error) {
      link.healthStatus = "broken"
      link.lastChecked = new Date().toISOString()
    }

    this.saveData()
    this.renderLinks()
  }

  async checkAllLinksHealth() {
    this.showToast("Checking all links...", "info")
    for (const link of this.links) {
      await this.checkLinkHealth(link.id)
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    this.showToast("Health check complete!", "success")
  }

  exportToHTML() {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>My Links - Exported from Link Manager</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #667eea; }
    .link { padding: 15px; margin: 10px 0; border: 1px solid #e2e8f0; border-radius: 8px; }
    .link-title { font-weight: bold; font-size: 1.1em; margin-bottom: 5px; }
    .link-url { color: #667eea; text-decoration: none; }
    .link-category { background: #667eea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>My Saved Links</h1>
  <p>Exported on ${new Date().toLocaleString()}</p>
`

    this.links.forEach(link => {
      html += `
  <div class="link">
    <div class="link-title">${link.title}</div>
    <a href="${link.url}" class="link-url">${link.url}</a>
    <p>${link.description || ''}</p>
    <span class="link-category">${link.category}</span>
    ${link.tags ? link.tags.map(tag => `<span class="link-category">${tag}</span>`).join(' ') : ''}
  </div>`
    })

    html += `
</body>
</html>`

    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `links-export-${new Date().toISOString().split("T")[0]}.html`
    a.click()
    URL.revokeObjectURL(url)
    this.showToast("Links exported as HTML!", "success")
  }

  exportToCSV() {
    let csv = "Title,URL,Category,Description,Tags,Created,Clicks\n"
    
    this.links.forEach(link => {
      const tags = link.tags ? link.tags.join(";") : ""
      csv += `"${link.title}","${link.url}","${link.category}","${link.description || ""}","${tags}","${link.createdAt}","${link.clickCount || 0}"\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `links-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    this.showToast("Links exported as CSV!", "success")
  }

  // ===== AI-POWERED FEATURES =====

  // AI-powered smart categorization
  async aiCategorizeLink(url, title) {
    if (!this.settings.aiEnabled || !this.settings.autoCategorize) {
      return this.settings.defaultCategory
    }

    // Check cache first
    const cacheKey = `cat_${url}`
    if (this.aiCache.has(cacheKey)) {
      return this.aiCache.get(cacheKey)
    }

    try {
      // Extract domain and analyze URL patterns
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()
      const path = urlObj.pathname.toLowerCase()
      const titleLower = title.toLowerCase()

      // AI-like pattern matching with keywords
      const patterns = {
        social: ['twitter', 'facebook', 'instagram', 'linkedin', 'reddit', 'tiktok', 'snapchat', 'pinterest', 'social', 'community'],
        work: ['github', 'gitlab', 'jira', 'slack', 'teams', 'notion', 'asana', 'trello', 'confluence', 'workspace', 'project', 'meeting', 'document', 'spreadsheet'],
        tools: ['tool', 'generator', 'converter', 'calculator', 'editor', 'utility', 'app', 'extension', 'plugin', 'api', 'dev', 'code'],
        personal: ['blog', 'recipe', 'fitness', 'health', 'shopping', 'amazon', 'ebay', 'personal', 'hobby', 'game']
      }

      // Score each category
      const scores = {}
      for (const [category, keywords] of Object.entries(patterns)) {
        scores[category] = 0
        for (const keyword of keywords) {
          if (domain.includes(keyword)) scores[category] += 3
          if (path.includes(keyword)) scores[category] += 2
          if (titleLower.includes(keyword)) scores[category] += 1
        }
      }

      // Get highest scoring category
      const category = Object.keys(scores).reduce((a, b) => 
        scores[a] > scores[b] ? a : b
      )

      // Only use AI suggestion if score is significant
      const result = scores[category] > 0 ? category : 'other'
      
      // Cache the result
      this.aiCache.set(cacheKey, result)
      return result

    } catch (error) {
      console.error('AI categorization error:', error)
      return 'other'
    }
  }

  // AI-powered tag suggestions
  async aiSuggestTags(url, title, description) {
    if (!this.settings.aiEnabled || !this.settings.smartTags) {
      return []
    }

    const cacheKey = `tags_${url}`
    if (this.aiCache.has(cacheKey)) {
      return this.aiCache.get(cacheKey)
    }

    try {
      const tags = new Set()
      const text = `${title} ${description} ${url}`.toLowerCase()

      // Technology tags
      const techKeywords = {
        'javascript': ['javascript', 'js', 'node', 'react', 'vue', 'angular'],
        'python': ['python', 'django', 'flask', 'pandas'],
        'design': ['design', 'ui', 'ux', 'figma', 'sketch'],
        'data': ['data', 'analytics', 'sql', 'database'],
        'ai': ['ai', 'ml', 'machine-learning', 'neural', 'gpt'],
        'tutorial': ['tutorial', 'guide', 'how-to', 'learn'],
        'documentation': ['docs', 'documentation', 'api', 'reference'],
        'video': ['youtube', 'video', 'watch', 'stream'],
        'article': ['article', 'blog', 'post', 'read'],
        'resource': ['resource', 'collection', 'awesome'],
        'important': ['important', 'urgent', 'critical'],
        'reference': ['reference', 'cheatsheet', 'quick']
      }

      for (const [tag, keywords] of Object.entries(techKeywords)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          tags.add(tag)
        }
      }

      const result = Array.from(tags).slice(0, 5) // Limit to 5 tags
      this.aiCache.set(cacheKey, result)
      return result

    } catch (error) {
      console.error('AI tag suggestion error:', error)
      return []
    }
  }

  // AI-powered description generation
  async aiGenerateDescription(url, title) {
    if (!this.settings.aiEnabled) {
      return ''
    }

    const cacheKey = `desc_${url}`
    if (this.aiCache.has(cacheKey)) {
      return this.aiCache.get(cacheKey)
    }

    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      const path = urlObj.pathname

      // Generate smart description based on patterns
      let description = ''

      if (domain.includes('github.com')) {
        const parts = path.split('/').filter(Boolean)
        if (parts.length >= 2) {
          description = `GitHub repository: ${parts[0]}/${parts[1]}`
        }
      } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        description = `YouTube video: ${title}`
      } else if (domain.includes('stackoverflow.com')) {
        description = `Stack Overflow discussion about ${title}`
      } else if (title && title.length > 10) {
        description = `${domain} - ${title.substring(0, 100)}`
      } else {
        description = `Resource from ${domain}`
      }

      this.aiCache.set(cacheKey, description)
      return description

    } catch (error) {
      console.error('AI description generation error:', error)
      return ''
    }
  }

  // AI-powered duplicate detection
  async aiDetectDuplicate(url) {
    try {
      const urlObj = new URL(url)
      const normalizedUrl = `${urlObj.hostname}${urlObj.pathname}`.toLowerCase()

      for (const link of this.links) {
        const linkUrlObj = new URL(link.url)
        const linkNormalized = `${linkUrlObj.hostname}${linkUrlObj.pathname}`.toLowerCase()

        // Check for exact match
        if (normalizedUrl === linkNormalized) {
          return { isDuplicate: true, existing: link, similarity: 100 }
        }

        // Check for high similarity
        const similarity = this.calculateStringSimilarity(normalizedUrl, linkNormalized)
        if (similarity > 85) {
          return { isDuplicate: true, existing: link, similarity }
        }
      }

      return { isDuplicate: false, existing: null, similarity: 0 }

    } catch (error) {
      console.error('Duplicate detection error:', error)
      return { isDuplicate: false, existing: null, similarity: 0 }
    }
  }

  // Helper: Calculate string similarity (Levenshtein distance)
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 100

    const editDistance = this.levenshteinDistance(longer, shorter)
    return Math.round((1 - editDistance / longer.length) * 100)
  }

  levenshteinDistance(str1, str2) {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // AI-powered smart search
  async aiSmartSearch(query) {
    if (!this.settings.aiEnabled || !query) {
      return this.links
    }

    const queryLower = query.toLowerCase()
    const results = []

    for (const link of this.links) {
      let score = 0
      
      // Exact matches get higher scores
      if (link.title.toLowerCase().includes(queryLower)) score += 10
      if (link.url.toLowerCase().includes(queryLower)) score += 5
      if (link.description && link.description.toLowerCase().includes(queryLower)) score += 7
      if (link.tags && link.tags.some(tag => tag.toLowerCase().includes(queryLower))) score += 8

      // Fuzzy matching for typos
      const titleSimilarity = this.calculateStringSimilarity(queryLower, link.title.toLowerCase())
      if (titleSimilarity > 60) score += titleSimilarity / 10

      // Category match
      if (link.category.toLowerCase().includes(queryLower)) score += 6

      // Recent links get slight boost
      const daysSinceCreated = (Date.now() - new Date(link.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceCreated < 7) score += 2

      // Frequently clicked links get boost
      if (link.clickCount > 5) score += Math.min(link.clickCount / 2, 5)

      if (score > 0) {
        results.push({ link, score })
      }
    }

    // Sort by score and return links
    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.link)
  }

  // Apply AI enhancements to new link
  async enhanceLinkWithAI(linkData) {
    if (!this.settings.aiEnabled) {
      return linkData
    }

    this.showToast("🤖 AI analyzing link...", "info")

    // Check for duplicates
    const duplicateCheck = await this.aiDetectDuplicate(linkData.url)
    if (duplicateCheck.isDuplicate) {
      const confirm = window.confirm(
        `⚠️ Similar link found (${duplicateCheck.similarity}% match):\n"${duplicateCheck.existing.title}"\n\nDo you still want to add this link?`
      )
      if (!confirm) {
        throw new Error('Duplicate link cancelled')
      }
    }

    // Auto-categorize if not set or default
    if (!linkData.category || linkData.category === 'other') {
      const aiCategory = await this.aiCategorizeLink(linkData.url, linkData.title)
      if (aiCategory && aiCategory !== 'other') {
        linkData.category = aiCategory
        this.showToast(`🤖 AI categorized as: ${aiCategory}`, "success")
      }
    }

    // Generate description if empty
    if (!linkData.description || linkData.description.trim() === '') {
      const aiDescription = await this.aiGenerateDescription(linkData.url, linkData.title)
      if (aiDescription) {
        linkData.description = aiDescription
      }
    }

    // Suggest tags
    const aiTags = await this.aiSuggestTags(linkData.url, linkData.title, linkData.description)
    if (aiTags.length > 0) {
      linkData.tags = aiTags
      this.showToast(`🏷️ AI suggested ${aiTags.length} tags`, "success")
    }

    return linkData
  }
}

// Initialize the app
let linksManager
document.addEventListener("DOMContentLoaded", () => {
  linksManager = new LinksManager()
})
