class InventoryV2Bootstrap {
  static create({ autoMount = true, autoOpen = false, ...options } = {}) {
    const ui = new globalThis.InventoryV2UI({
      ...options,
      facadeContract: globalThis.InventoryV2FacadeContract,
      actionContract: globalThis.InventoryV2ActionContract,
      actionTypes: globalThis.InventoryV2ActionType,
      createPresentation: (presentationOptions) => InventoryV2Bootstrap.#createPresentation(presentationOptions),
    });
    if (autoMount) ui.mount();
    if (autoOpen) ui.open();
    return ui;
  }

  // Create the existing UI tree only after UI validates its facade/mount; keep collaborator order and overrides.
  static #createPresentation({
    documentRef,
    rarityDomAdapter,
    rarityVisualResolver,
    progressionDomAdapter,
    conditionDomAdapter,
    normalizer,
    longPressController,
    headerRenderer,
    loadoutRenderer,
    assemblyRenderer,
    savedLoadoutRenderer,
    inventoryRenderer,
    tooltipPresenter,
    balanceParameterResolver,
    resourceMeterResolver,
    resourceMeterRenderer,
    degradationColorResolver,
  }) {
    const LongPressController = globalThis.InventoryV2LongPressController;
    const dom = new globalThis.InventoryV2DomFactory(documentRef);
    const resolvedNormalizer =
      normalizer || new globalThis.InventoryV2ViewModelNormalizer();
    const resolvedLongPressController =
      longPressController || new LongPressController({
        degradationColorResolver,
      });
    const resolvedTooltipPresenter =
      tooltipPresenter ||
      new globalThis.InventoryV2TooltipPresenter({
        documentRef,
        getView: () => dom.view,
        rarityDomAdapter,
        balanceParameterResolver:
          balanceParameterResolver ||
          new globalThis.InventoryV2BalanceParameterResolver({
            rarityVisualResolver,
          }),
      });

    const attachmentRenderer =
      new globalThis.InventoryV2AttachmentBadgeRenderer({
        domFactory: dom,
      });
    const resolvedResourceMeterResolver =
      resourceMeterResolver || new globalThis.InventoryV2ResourceMeterResolver();
    const resolvedResourceMeterRenderer =
      resourceMeterRenderer ||
      new globalThis.InventoryV2ResourceMeterRenderer({ domFactory: dom });
    const itemParametersResolver =
      new globalThis.InventoryV2ItemParametersResolver({
        resourceMeterResolver: resolvedResourceMeterResolver,
        progressionDomAdapter,
        rarityVisualResolver,
      });
    const itemParametersRenderer =
      new globalThis.InventoryV2ItemParametersRenderer({
        domFactory: dom,
        resolver: itemParametersResolver,
        resourceMeterRenderer: resolvedResourceMeterRenderer,
      });
    const resolvedItemRenderer = new globalThis.InventoryV2ItemCardRenderer({
      domFactory: dom,
      attachmentRenderer,
      longPressController: resolvedLongPressController,
      rarityDomAdapter,
      progressionDomAdapter,
      conditionDomAdapter,
      tooltipPresenter: resolvedTooltipPresenter,
      resourceMeterResolver: resolvedResourceMeterResolver,
      resourceMeterRenderer: resolvedResourceMeterRenderer,
    });
    const resolvedHeaderRenderer =
      headerRenderer ||
      new globalThis.InventoryV2HeaderRenderer({ domFactory: dom });
    const resolvedLoadoutRenderer =
      loadoutRenderer ||
      new globalThis.InventoryV2LoadoutPanelRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        getEquippedLongPressDurationMs: () => LongPressController.EQUIPPED_DURATION_MS,
      });
    const resolvedAssemblyRenderer =
      assemblyRenderer ||
      new globalThis.InventoryV2AssemblyEditorRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        createParameterSectionResolver: () => new globalThis.InventoryV2AssemblyParameterSectionResolver(),
      });
    const resolvedSavedLoadoutRenderer =
      savedLoadoutRenderer ||
      new globalThis.InventoryV2SavedLoadoutPreviewRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
      });
    const resolvedInventoryRenderer =
      inventoryRenderer ||
      new globalThis.InventoryV2InventoryGridRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        createHorizontalScrollController: () => new globalThis.HorizontalScrollController(),
      });
    return {
      dom,
      resolvedNormalizer,
      resolvedLongPressController,
      resolvedTooltipPresenter,
      resolvedItemRenderer,
      resolvedHeaderRenderer,
      resolvedLoadoutRenderer,
      resolvedAssemblyRenderer,
      resolvedSavedLoadoutRenderer,
      resolvedInventoryRenderer,
    };
  }
}

globalThis.InventoryV2Bootstrap = InventoryV2Bootstrap;
