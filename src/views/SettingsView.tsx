import { t, withDisplayName } from '../lib/i18n';

export function SettingsView(props: any) {
  const {
    locale,
    budgetInputValue,
    setBudgetInputValue,
    yearlyBudgetInputValue,
    setYearlyBudgetInputValue,
    income,
    yearlyBudget,
    handleSaveBudget,
    projects,
    openProjectModal,
    editingProjectId,
    editingProjectName,
    setEditingProjectName,
    handleRenameProject,
    handleManageInputKeyDown,
    setEditingProjectId,
    handleDeleteProjectFromSettings,
    customCategories,
    openCategoryModal,
    editingCategoryId,
    editingCategoryName,
    setEditingCategoryName,
    handleRenameCategory,
    setEditingCategoryId,
    handleDeleteCategoryFromSettings,
    handleImportClick,
    setExportModalOpen,
    setBulkDeleteModalOpen,
    setBackgroundModalOpen,
    setLocale,
    user,
    handleSignOut,
    importInputRef,
    handleImportCsv,
  } = props;

  return (
    <section className="settings-grid">
      <section className="panel">
        <div className="settings-header" style={{ marginBottom: '16px' }}>
          <h3>{t(locale, 'budgetShort')}</h3>
        </div>

        <div style={{ background: '#111214', border: '1px solid #2c2c2e', borderRadius: '16px', overflow: 'hidden' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #2c2c2e', cursor: 'pointer' }}>
            <span style={{ fontSize: '15px', fontWeight: '500', color: '#f5f5f7' }}>{t(locale, 'monthly')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <input
                type="number"
                min="0"
                step="50"
                value={budgetInputValue}
                onChange={(event) => setBudgetInputValue(event.target.value)}
                onFocus={(event) => { if (event.target.value === '0') setBudgetInputValue(''); }}
                onBlur={() => { if (budgetInputValue === '') setBudgetInputValue('0'); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', fontWeight: '600', textAlign: 'right', width: '100px', outline: 'none', padding: 0 }}
              />
              <span style={{ fontSize: '16px', color: '#8e8e93', fontWeight: '500' }}>€</span>
            </div>
          </label>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
            <span style={{ fontSize: '15px', fontWeight: '500', color: '#f5f5f7' }}>{t(locale, 'yearly')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <input
                type="number"
                min="0"
                step="100"
                value={yearlyBudgetInputValue}
                onChange={(event) => setYearlyBudgetInputValue(event.target.value)}
                onFocus={(event) => { if (event.target.value === '0') setYearlyBudgetInputValue(''); }}
                onBlur={() => { if (yearlyBudgetInputValue === '') setYearlyBudgetInputValue('0'); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', fontWeight: '600', textAlign: 'right', width: '100px', outline: 'none', padding: 0 }}
              />
              <span style={{ fontSize: '16px', color: '#8e8e93', fontWeight: '500' }}>€</span>
            </div>
          </label>
        </div>

        {(Number(budgetInputValue) !== income || Number(yearlyBudgetInputValue) !== yearlyBudget) && (
          <button className="primary-btn" style={{ marginTop: '14px', width: '100%', borderRadius: '14px', padding: '14px', fontSize: '16px' }} onClick={handleSaveBudget}>
            {t(locale, 'save')}
          </button>
        )}
      </section>

      <section className="panel">
        <div className="settings-header">
          <h3>{t(locale, 'projects')}</h3>
          <button className="ghost-btn" onClick={openProjectModal}>{t(locale, 'add')}</button>
        </div>
        <div className="category-manage-list">
          {projects.length === 0 ? (
            <p className="empty-line">{t(locale, 'noProjects')}</p>
          ) : (
            projects.map((project: any) => (
              <div key={project.id}>
                <div className="category-manage-row editable-row manage-main" style={{ paddingRight: '8px' }}>
                  {editingProjectId === project.id ? (
                    <>
                      <div className="category-manage-copy">
                        <input
                          value={editingProjectName}
                          onChange={(event) => setEditingProjectName(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={() => handleRenameProject(project.id)}
                          onKeyDown={(event) => handleManageInputKeyDown(event, () => handleRenameProject(project.id), () => { setEditingProjectId(null); setEditingProjectName(''); })}
                          autoFocus
                        />
                      </div>
                      <button style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={(event) => { event.stopPropagation(); handleRenameProject(project.id); }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#32d74b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="category-manage-copy"><strong>{project.name}</strong></div>
                      <button style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '4px' }} onClick={(event) => { event.stopPropagation(); handleDeleteProjectFromSettings(project.id); }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ff453a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                      <button style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={(event) => { event.stopPropagation(); setEditingProjectId(project.id); setEditingProjectName(project.name); }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#0a84ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="settings-header">
          <h3>{t(locale, 'manageCategories')}</h3>
          <button className="ghost-btn" onClick={() => openCategoryModal(false)}>{t(locale, 'add')}</button>
        </div>
        <div className="category-manage-list">
          {customCategories.length === 0 ? (
            <p className="empty-line">{t(locale, 'noCustomCategories')}</p>
          ) : (
            withDisplayName(locale, customCategories).map((category) => (
              <div key={category.id}>
                <div className="category-manage-row editable-row manage-main" style={{ paddingRight: '8px' }}>
                  {editingCategoryId === category.id ? (
                    <>
                      <div className="category-manage-copy">
                        <span className="category-manage-emoji">{category.emoji}</span>
                        <input
                          value={editingCategoryName}
                          onChange={(event) => setEditingCategoryName(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={() => handleRenameCategory(category.id)}
                          onKeyDown={(event) => handleManageInputKeyDown(event, () => handleRenameCategory(category.id), () => { setEditingCategoryId(null); setEditingCategoryName(''); })}
                          autoFocus
                        />
                      </div>
                      <button style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={(event) => { event.stopPropagation(); handleRenameCategory(category.id); }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#32d74b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="category-manage-copy">
                        <span className="category-manage-emoji">{category.emoji}</span>
                        <strong>{category.displayName}</strong>
                      </div>
                      <button style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '4px' }} onClick={(event) => { event.stopPropagation(); handleDeleteCategoryFromSettings(category.id); }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ff453a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                      <button style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={(event) => { event.stopPropagation(); setEditingCategoryId(category.id); setEditingCategoryName(category.name); }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="#0a84ff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <h3>{t(locale, 'manageData')}</h3>
        <div className="settings-actions">
          <button className="settings-card" onClick={handleImportClick}>
            <strong>{t(locale, 'importCsv')}</strong>
            <span>{t(locale, 'importCsvDesc')}</span>
          </button>
          <button className="settings-card" onClick={() => setExportModalOpen(true)}>
            <strong>{t(locale, 'exportCsv')}</strong>
            <span>{t(locale, 'exportCsvDesc')}</span>
          </button>
          <button className="settings-card" onClick={() => setBulkDeleteModalOpen(true)}>
            <strong style={{ color: '#ff453a' }}>{t(locale, 'bulkDelete')}</strong>
            <span>{t(locale, 'bulkDeleteDesc')}</span>
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="settings-header">
          <div><h3>{t(locale, 'background')}</h3></div>
          <button className="ghost-btn" onClick={() => setBackgroundModalOpen(true)}>{t(locale, 'chooseBackground')}</button>
        </div>
      </section>

      <section className="panel">
        <div className="settings-header">
          <div>
            <h3>{t(locale, 'language')}</h3>
            <p>{t(locale, 'appLanguageHint')}</p>
          </div>
          <div className="lang-switch">
            <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
            <button className={locale === 'el' ? 'active' : ''} onClick={() => setLocale('el')}>GR</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="settings-header">
          <div>
            <h3>{t(locale, 'signedInAs')}</h3>
            <p>{user.email}</p>
          </div>
          <button className="ghost-btn" onClick={handleSignOut}>{t(locale, 'signOut')}</button>
        </div>
      </section>

      <input ref={importInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={handleImportCsv} />
    </section>
  );
}
