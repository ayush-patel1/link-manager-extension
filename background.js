class BackgroundManager {
  constructor() {
    this.init()
  }

  init() {
    this.setupAlarmListener()
    this.setupContextMenu()
    this.setupInstallListener()
    this.setupNotificationListener()
  }

  setupAlarmListener() {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      console.log("Alarm triggered:", alarm.name)
      try {
        const result = await chrome.storage.sync.get(["reminders", "settings"])
        const reminders = result.reminders || []
        const settings = result.settings || { enableNotifications: true }

        const reminder = reminders.find((r) => r.id === alarm.name)
        console.log("Found reminder:", reminder)

        if (reminder && !reminder.completed) {
          if (settings.enableNotifications) {
            await this.showNotification(reminder)
          }

          // Mark reminder as completed and remove it after notification
          const updatedReminders = reminders.filter((r) => r.id !== reminder.id)
          await chrome.storage.sync.set({ reminders: updatedReminders })
          console.log("Reminder completed and removed:", reminder.title)
        }
      } catch (error) {
        console.error("Error handling alarm:", error)
      }
    })
  }

  setupContextMenu() {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: "addToLinksPlus",
        title: "Add to Links++",
        contexts: ["link", "page"],
      })

      chrome.contextMenus.create({
        id: "openLinksPlus",
        title: "Open Links++",
        contexts: ["all"],
      })
    })

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === "addToLinksPlus") {
        const url = info.linkUrl || info.pageUrl
        const title = info.selectionText || tab.title
        await this.addLinkFromContext(url, title)
      } else if (info.menuItemId === "openLinksPlus") {
        chrome.action.openPopup()
      }
    })
  }

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.showWelcomeNotification()
      }
    })
  }

  setupNotificationListener() {
    // Handle notification clicks
    chrome.notifications.onClicked.addListener((notificationId) => {
      chrome.action.openPopup()
      chrome.notifications.clear(notificationId)
    })

    // Handle notification button clicks
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
      if (buttonIndex === 0) {
        // Dismiss button - already handled by alarm, just clear notification
        chrome.notifications.clear(notificationId)
      } else if (buttonIndex === 1) {
        // Dismiss button
        chrome.notifications.clear(notificationId)
      }
    })

    // Auto-close notification after it's shown
    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      console.log(`Notification ${notificationId} closed by user: ${byUser}`)
    })
  }

  async addLinkFromContext(url, title) {
    try {
      const result = await chrome.storage.sync.get(["links"])
      const links = result.links || []

      const newLink = {
        id: Date.now().toString(),
        title: title.substring(0, 100), // Limit title length
        url: url,
        category: "other",
        description: "Added from context menu",
        createdAt: new Date().toISOString(),
        clickCount: 0,
      }

      links.unshift(newLink)
      await chrome.storage.sync.set({ links })

      await this.showSimpleNotification({
        title: "Link Added!",
        message: `"${title}" has been added to Links++`,
      })
    } catch (error) {
      console.error("Error adding link from context:", error)
    }
  }

  async showNotification(reminder) {
    const options = {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: `⏰ Reminder: ${reminder.title}`,
      message: reminder.description || "Your reminder is due!",
      priority: reminder.priority === "high" ? 2 : 1,
      requireInteraction: reminder.priority === "high",
      buttons: [{ title: "Dismiss" }],
    }

    try {
      await chrome.notifications.create(reminder.id, options)
      console.log("Notification created for reminder:", reminder.title)

      // Auto-clear notification after 1 minute for non-high priority
      if (reminder.priority !== "high") {
        setTimeout(() => {
          chrome.notifications.clear(reminder.id)
        }, 60000)
      }
    } catch (error) {
      console.error("Error creating notification:", error)
    }
  }

  async showSimpleNotification({ title, message }) {
    try {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: title,
        message: message,
      })
    } catch (error) {
      console.error("Error showing notification:", error)
    }
  }

  showWelcomeNotification() {
    chrome.notifications.create("welcome", {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Welcome to Links++!",
      message: "Your smart link manager is ready to use. Click the extension icon to get started!",
    })
  }
}

// Initialize background manager
new BackgroundManager()

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  chrome.action.openPopup()
})

// Message handling for content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLinks") {
    chrome.storage.sync.get(["links"]).then((result) => {
      sendResponse({ links: result.links || [] })
    })
    return true // Keep message channel open for async response
  }

  if (request.action === "addLink") {
    chrome.storage.sync.get(["links"]).then(async (result) => {
      const links = result.links || []
      links.unshift(request.link)
      await chrome.storage.sync.set({ links })
      sendResponse({ success: true })
    })
    return true
  }

  if (request.action === "testNotification") {
    chrome.notifications.create("test", {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Test Notification",
      message: "This is a test notification from Links++!",
    })
    sendResponse({ success: true })
    return true
  }

  if (request.action === "createAlarm") {
    const reminder = request.reminder
    const reminderTime = new Date(reminder.time).getTime()
    
    chrome.alarms.clear(reminder.id).then(() => {
      chrome.alarms.create(reminder.id, {
        when: reminderTime,
      }).then(() => {
        console.log(`Alarm created for reminder: ${reminder.title} at ${new Date(reminderTime).toLocaleString()}`)
        sendResponse({ success: true })
      }).catch((error) => {
        console.error("Error creating alarm:", error)
        sendResponse({ success: false, error: error.message })
      })
    })
    return true
  }

  if (request.action === "clearAlarm") {
    chrome.alarms.clear(request.alarmId).then((wasCleared) => {
      console.log(`Alarm ${request.alarmId} cleared:`, wasCleared)
      sendResponse({ success: true })
    }).catch((error) => {
      console.error("Error clearing alarm:", error)
      sendResponse({ success: false })
    })
    return true
  }
})
