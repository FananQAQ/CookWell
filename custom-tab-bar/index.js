Component({
  data: {
    selected: 0,
    color: '#8a8a8a',
    selectedColor: '#c45c26',
    list: [
      {
        pagePath: '/pages/discover/discover',
        text: '菜谱',
        iconPath: '/images/tab-discover.png',
        selectedIconPath: '/images/tab-discover.png'
      },
      {
        pagePath: '/pages/mine/mine',
        text: '我的菜单',
        iconPath: '/images/tab-mine.png',
        selectedIconPath: '/images/tab-mine.png'
      }
    ]
  },
  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      if (!Number.isFinite(index) || index < 0 || index >= this.data.list.length) {
        return
      }
      const path = this.data.list[index].pagePath
      wx.switchTab({ url: path })
      this.setData({ selected: index })
    }
  }
})
