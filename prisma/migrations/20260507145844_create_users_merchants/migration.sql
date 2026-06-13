BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_role_df];
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_role_df] DEFAULT 'OPERATION' FOR [role];

-- CreateTable
CREATE TABLE [dbo].[merchants] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000) NOT NULL,
    [commercialRegister] NVARCHAR(1000),
    [taxCard] NVARCHAR(1000),
    [website] NVARCHAR(1000),
    [facebookPage] NVARCHAR(1000),
    [instagramPage] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [merchants_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [merchants_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [merchants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [createdBy] INT,
    [updatedBy] INT,
    CONSTRAINT [merchants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [merchants_phone_key] UNIQUE NONCLUSTERED ([phone])
);

-- CreateTable
CREATE TABLE [dbo].[merchant_attachments] (
    [id] NVARCHAR(1000) NOT NULL,
    [merchantId] NVARCHAR(1000) NOT NULL,
    [fileName] NVARCHAR(1000) NOT NULL,
    [fileUrl] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [merchant_attachments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [merchant_attachments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[merchant_prices] (
    [id] NVARCHAR(1000) NOT NULL,
    [merchantId] NVARCHAR(1000) NOT NULL,
    [governorate] NVARCHAR(1000) NOT NULL,
    [city] NVARCHAR(1000) NOT NULL,
    [shipmentStatus] NVARCHAR(1000) NOT NULL,
    [price] DECIMAL(10,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [merchant_prices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [merchant_prices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [merchant_prices_merchantId_idx] ON [dbo].[merchant_prices]([merchantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [merchant_prices_governorate_city_idx] ON [dbo].[merchant_prices]([governorate], [city]);

-- AddForeignKey
ALTER TABLE [dbo].[merchants] ADD CONSTRAINT [merchants_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[merchants] ADD CONSTRAINT [merchants_updatedBy_fkey] FOREIGN KEY ([updatedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[merchant_attachments] ADD CONSTRAINT [merchant_attachments_merchantId_fkey] FOREIGN KEY ([merchantId]) REFERENCES [dbo].[merchants]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[merchant_prices] ADD CONSTRAINT [merchant_prices_merchantId_fkey] FOREIGN KEY ([merchantId]) REFERENCES [dbo].[merchants]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
