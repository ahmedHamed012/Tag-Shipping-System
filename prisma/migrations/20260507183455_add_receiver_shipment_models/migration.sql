BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[receivers] (
    [id] INT NOT NULL IDENTITY(1,1),
    [fullName] NVARCHAR(1000) NOT NULL,
    [phone1] NVARCHAR(1000) NOT NULL,
    [phone2] NVARCHAR(1000),
    [address] NVARCHAR(1000) NOT NULL,
    [governorate] NVARCHAR(1000),
    [city] NVARCHAR(1000),
    [notes] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [receivers_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [receivers_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [receivers_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdBy] INT,
    [updatedAt] DATETIME2 NOT NULL,
    [lastModifiedBy] INT,
    CONSTRAINT [receivers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[shipments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [merchantId] NVARCHAR(1000) NOT NULL,
    [receiverId] INT NOT NULL,
    [policyNumber] NVARCHAR(1000),
    [isOpenable] BIT NOT NULL CONSTRAINT [shipments_isOpenable_df] DEFAULT 0,
    [isFastDelivery] BIT NOT NULL CONSTRAINT [shipments_isFastDelivery_df] DEFAULT 0,
    [shipmentStatus] NVARCHAR(1000) NOT NULL,
    [courierId] INT,
    [inventoryId] INT,
    [inventoryCourierId] INT,
    [totalAmount] DECIMAL(10,2) NOT NULL,
    [amountGained] DECIMAL(10,2) NOT NULL,
    [additionalNotes] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [shipments_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [shipments_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [shipments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdBy] INT,
    [updatedAt] DATETIME2 NOT NULL,
    [lastModifiedBy] INT,
    CONSTRAINT [shipments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[shipment_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [shipmentId] INT NOT NULL,
    [productName] NVARCHAR(1000) NOT NULL,
    [productDescription] NVARCHAR(max),
    [netWeight] DECIMAL(10,2),
    [size] NVARCHAR(1000),
    [count] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [shipment_items_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [shipment_items_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [shipment_items_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdBy] INT,
    [updatedAt] DATETIME2 NOT NULL,
    [lastModifiedBy] INT,
    CONSTRAINT [shipment_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [receivers_phone1_idx] ON [dbo].[receivers]([phone1]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [receivers_fullName_idx] ON [dbo].[receivers]([fullName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [shipments_merchantId_idx] ON [dbo].[shipments]([merchantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [shipments_receiverId_idx] ON [dbo].[shipments]([receiverId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [shipment_items_shipmentId_idx] ON [dbo].[shipment_items]([shipmentId]);

-- AddForeignKey
ALTER TABLE [dbo].[receivers] ADD CONSTRAINT [receivers_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[receivers] ADD CONSTRAINT [receivers_lastModifiedBy_fkey] FOREIGN KEY ([lastModifiedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_merchantId_fkey] FOREIGN KEY ([merchantId]) REFERENCES [dbo].[merchants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_receiverId_fkey] FOREIGN KEY ([receiverId]) REFERENCES [dbo].[receivers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_lastModifiedBy_fkey] FOREIGN KEY ([lastModifiedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[shipment_items] ADD CONSTRAINT [shipment_items_shipmentId_fkey] FOREIGN KEY ([shipmentId]) REFERENCES [dbo].[shipments]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
